// Ensure you have VITE_RAPIDAPI_KEY set in your .env file

interface RapidAPIRegion {
  type: string;
  gaiaId?: string | number;
  regionId?: string | number;
  regionNames?: {
    fullName: string;
  };
  name?: string;
}

interface RapidAPIHotel {
  name: string;
  price?: {
    priceSummary?: {
      displayPrices?: Array<{ value: string }>;
    };
    lead?: {
      amount: number | string;
    };
  };
  ratePlan?: {
    price?: {
      current: string;
    };
  };
  optimizedPrice?: {
    displayPrice: string;
  };
  propertyImage?: {
    image?: {
      url: string;
    };
    url?: string;
  };
  mediaSection?: {
    media?: Array<{ url: string }>;
  };
  optimizedThumbUrls?: {
    srpDesktop: string;
  };
  thumbnailUrl?: string;
  neighborhood?: {
    name: string;
  };
  address?: {
    locality: string;
  };
  guestRating?: {
    rating: number | string;
  };
  guestReviews?: {
    rating: number | string;
  };
  starRating?: number | string;
  short_amenities?: string[];
  amenities?: Array<{ description: string }>;
}

export const getHotelsFromRapidAPI = async (
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number
) => {
  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY;

  if (!apiKey) {
    throw new Error('RapidAPI key is missing! Please add VITE_RAPIDAPI_KEY to your .env file.');
  }

  try {
    // ── Step 1: Resolve destination → gaiaId via v2/regions ──────────────────
    // The v2/regions endpoint returns { sr: [...] } at the root (NOT { data: [...] }).
    // Each item in `sr` has a `gaiaId` field that is used as `region_id` in hotel search.
    const regUrl = new URL('https://hotels-com-provider.p.rapidapi.com/v2/regions');
    regUrl.searchParams.append('query', destination);
    regUrl.searchParams.append('locale', 'en_US');
    regUrl.searchParams.append('domain', 'US');

    const regResponse = await fetch(regUrl.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'hotels-com-provider.p.rapidapi.com'
      }
    });

    if (!regResponse.ok) {
      throw new Error(`Region fetch failed: ${regResponse.status}`);
    }

    const regData = await regResponse.json();

    // Support both response shapes: { sr: [...] } and { data: [...] }
    const regionList: RapidAPIRegion[] = regData.sr || regData.data || (Array.isArray(regData) ? regData : []);

    console.log(`[RapidAPI] v2/regions raw keys:`, Object.keys(regData));
    console.log(`[RapidAPI] Region list length: ${regionList.length}`);

    if (regionList.length === 0) {
      throw new Error(`Destination not found for query: "${destination}"`);
    }

    // Prefer CITY or NEIGHBORHOOD; fallback to first result
    const searchableRegion =
      regionList.find((r: RapidAPIRegion) => r.type === 'CITY' || r.type === 'NEIGHBORHOOD') ||
      regionList[0];

    // gaiaId is the correct field; some responses also have regionId
    const regionId: string | undefined =
      searchableRegion.gaiaId?.toString() ||
      searchableRegion.regionId?.toString();

    console.log(`[RapidAPI] Selected region:`, JSON.stringify({
      name: searchableRegion.regionNames?.fullName || searchableRegion.name,
      type: searchableRegion.type,
      gaiaId: searchableRegion.gaiaId,
      regionId: searchableRegion.regionId,
    }));

    if (!regionId) {
      console.error('[RapidAPI] Full region object:', JSON.stringify(searchableRegion, null, 2));
      throw new Error('Could not extract a valid region ID from the regions response.');
    }

    // ── Step 2: Search hotels using v3/hotels/search ──────────────────────────
    const searchUrl = new URL('https://hotels-com-provider.p.rapidapi.com/v3/hotels/search');
    searchUrl.searchParams.append('region_id', regionId);
    searchUrl.searchParams.append('locale', 'en_US');
    searchUrl.searchParams.append('checkin_date', checkIn);
    searchUrl.searchParams.append('checkout_date', checkOut);
    searchUrl.searchParams.append('adults_number', guests.toString());
    searchUrl.searchParams.append('domain', 'US');
    searchUrl.searchParams.append('sort_order', 'RECOMMENDED');

    console.log(`[RapidAPI] v3 hotel search → region_id="${regionId}" checkin="${checkIn}" checkout="${checkOut}" guests=${guests}`);

    let searchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'hotels-com-provider.p.rapidapi.com'
      }
    });

    if (!searchResponse.ok) {
      const errBody = await searchResponse.json().catch(() => ({}));
      console.error(`[RapidAPI] v3 search failed (${searchResponse.status}):`, JSON.stringify(errBody, null, 2));

      // ── Fallback: v2/hotels/search ─────────────────────────────────────────
      console.warn(`[RapidAPI] Trying v2/hotels/search fallback...`);
      const v2Url = new URL('https://hotels-com-provider.p.rapidapi.com/v2/hotels/search');
      v2Url.searchParams.append('region_id', regionId);
      v2Url.searchParams.append('locale', 'en_US');
      v2Url.searchParams.append('checkin_date', checkIn);
      v2Url.searchParams.append('checkout_date', checkOut);
      v2Url.searchParams.append('adults_number', guests.toString());
      v2Url.searchParams.append('domain', 'US');
      v2Url.searchParams.append('sort_order', 'RECOMMENDED');

      searchResponse = await fetch(v2Url.toString(), {
        method: 'GET',
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'hotels-com-provider.p.rapidapi.com'
        }
      });

      if (!searchResponse.ok) {
        const v2ErrBody = await searchResponse.json().catch(() => ({}));
        console.error(`[RapidAPI] v2 search also failed (${searchResponse.status}):`, JSON.stringify(v2ErrBody, null, 2));
      }
    }

    if (!searchResponse.ok) {
      throw new Error(`Hotel search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    // Support both v3 and v2 response shapes
    const results: RapidAPIHotel[] =
      searchData.data?.propertySearch?.properties ||
      searchData.data?.properties ||
      searchData.data?.body?.searchResults?.results ||
      [];

    console.log(`[RapidAPI] Hotel results count: ${results.length}`);

    if (results.length === 0) {
      return [];
    }

    // ── Step 3: Transform to ZenTravel schema ─────────────────────────────────
    return results.slice(0, 15).map((h: RapidAPIHotel, index: number) => {
      const priceStr =
        h.price?.priceSummary?.displayPrices?.[0]?.value ||
        h.price?.lead?.amount?.toString() ||
        h.ratePlan?.price?.current ||
        h.optimizedPrice?.displayPrice || '';

      let imageUrl =
        h.propertyImage?.image?.url ||
        h.propertyImage?.url ||
        h.mediaSection?.media?.[0]?.url ||
        h.optimizedThumbUrls?.srpDesktop ||
        h.thumbnailUrl || '';

      // Fix protocol-relative and root-relative URLs
      if (imageUrl.startsWith('//')) imageUrl = `https:${imageUrl}`;
      else if (imageUrl.startsWith('/')) imageUrl = `https://images.trvl-media.com${imageUrl}`;

      const match = priceStr.match(/([0-9,.]+)/);
      const usdPrice = match ? parseFloat(match[1].replace(/,/g, '')) : 0;
      const myrPrice = Math.round(usdPrice * 4.7);
      const formattedPrice = myrPrice > 0 ? `MYR ${myrPrice}` : 'Contact for price';

      return {
        name: h.name,
        location: h.neighborhood?.name || h.address?.locality || destination,
        price: formattedPrice,
        rating:
          h.guestRating?.rating?.toString() ||
          h.guestReviews?.rating?.toString() ||
          h.starRating?.toString() ||
          'N/A',
        description: h.starRating
          ? `${h.starRating} star property with great amenities.`
          : 'Comfortable stay in a prime location.',
        amenities:
          h.short_amenities ||
          h.amenities?.map((a: { description: string }) => a.description) ||
          ['Free WiFi', 'Air Conditioning', 'Housekeeping'],
        imageUrl,
        image_keyword: destination,
        isRecommended: index === 0,
      };
    });

  } catch (error) {
    console.error('[RapidAPI] Fatal error:', error);
    throw error;
  }
};
