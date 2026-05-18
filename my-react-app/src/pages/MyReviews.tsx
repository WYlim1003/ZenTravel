import { useEffect, useState } from 'react';
import { db, auth } from '../services/firebase';
import {
  collection, query, where, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc
} from 'firebase/firestore';
import { ArrowLeft, Star } from 'lucide-react';
import mascotImg from '../assets/MASCOT.png';
import '../styles/MyReviews.css';

export const MyReviews = ({ setView }: { setView: (v: string) => void }) => {
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedBooking, setSelectedBooking] = useState<Record<string, unknown> | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    const qReviews = query(collection(db, "My_Reviews"), where("userId", "==", uid));
    const unsubReviews = onSnapshot(qReviews, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qPending = query(
      collection(db, "Booking"),
      where("userId", "==", uid),
      where("status", "==", "past"),
      where("type", "==", "hotel")
    );
    
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      const bookings = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((b: { hasReviewed?: boolean }) => b.hasReviewed !== true);
      setPendingBookings(bookings);
    });

    return () => {
      unsubReviews();
      unsubPending();
    };
  }, []);

  const handleSubmitReview = async () => {
    if (!selectedBooking || !comment.trim()) return;

    try {
      await addDoc(collection(db, "My_Reviews"), {
        userId: auth.currentUser?.uid,
        hotelName: selectedBooking.name || selectedBooking.hotelName,
        hotelImage: selectedBooking.imageUrl || selectedBooking.image,
        rating: rating,
        content: comment,
        date: selectedBooking.date || "",
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, "Booking", selectedBooking.id), {
        hasReviewed: true
      });

      setSelectedBooking(null);
      setComment('');
      setRating(5);
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Failed to submit review. Please try again.");
    }
  };

  return (
    <div className="reviews-page-root">
      <header className="zen-purple-header">
        <ArrowLeft className="header-icon-left" onClick={() => setView('profile')} />
        <h1 className="header-centered-title">My Reviews</h1>
        <div className="header-placeholder-right"></div>
      </header>

      <div className="white-content-area">
        {loading ? (
          <div className="empty-state-container"><p>Loading...</p></div>
        ) : (
          <div className="review-list-grid">
            
            {pendingBookings.map(booking => (
              <div key={booking.id} className="review-card-item pending-review-card" style={{ borderLeft: '4px solid #7b2cbf', backgroundColor: '#f9f5ff' }}>
                <div className="review-hotel-header">
                  <img src={booking.imageUrl || booking.image} alt="hotel" className="small-hotel-img" />
                  <div className="hotel-meta-info">
                    <h4 style={{ color: '#7b2cbf' }}>Share your experience!</h4>
                    <p>{booking.name || booking.hotelName}</p>
                    <small>{booking.date}</small>
                  </div>
                </div>
                <button
                  className="btn-write-review"
                  style={{ marginTop: '10px', background: '#7b2cbf', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={() => setSelectedBooking(booking)}
                >
                  Write a Review
                </button>
              </div>
            ))}

            {reviews.length === 0 && pendingBookings.length === 0 ? (
              <div className="empty-state-container">
                <img src={mascotImg} alt="Mascot" className="mascot-img-center" />
                <p className="empty-msg-text">No reviews submitted yet.</p>
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="review-card-item">
                  <div className="review-hotel-header">
                    <img src={review.hotelImage} alt="hotel" className="small-hotel-img" />
                    <div className="hotel-meta-info">
                      <h4>{review.hotelName}</h4>
                      <p>{review.date}</p>
                    </div>
                    <div className="rating-pill">{review.rating} ★</div>
                  </div>
                  <p className="review-content-body">{review.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedBooking && (
        <div className="review-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="review-modal-content" style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '10px' }}>Review {selectedBooking.name || selectedBooking.hotelName}</h3>
            <p style={{ fontSize: '13px', color: '#666' }}>Stayed on: {selectedBooking.date}</p>
            
            <div style={{ display: 'flex', gap: '8px', margin: '20px 0' }}>
              {[1, 2, 3, 4, 5].map(num => (
                <Star
                  key={num}
                  size={28}
                  fill={num <= rating ? "#7b2cbf" : "none"}
                  color="#7b2cbf"
                  onClick={() => setRating(num)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </div>

            <textarea
              style={{ width: '100%', height: '120px', borderRadius: '12px', padding: '12px', marginBottom: '20px', border: '1px solid #ddd', fontSize: '14px', outline: 'none' }}
              placeholder="How was your stay?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setSelectedBooking(null)} style={{ padding: '10px 20px', borderRadius: '25px', border: '1px solid #ccc', background: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmitReview} style={{ padding: '10px 25px', borderRadius: '25px', border: 'none', background: '#7b2cbf', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
