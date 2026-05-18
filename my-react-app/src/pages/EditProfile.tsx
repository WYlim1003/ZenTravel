import React, { useState, useEffect } from 'react';
import { auth, db, storage } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { ArrowLeft, Camera, CreditCard, Landmark, Wallet, Loader2 } from 'lucide-react';
import mascotImg from '../assets/MASCOT.png';
import '../styles/EditProfile.css';

export const EditProfile = ({ setView }: { setView: (v: string) => void }) => {
  const user = auth.currentUser;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    phoneNumber: '',
    email: user?.email || '',
    paymentMethod: 'credit_card'
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setFormData(prev => ({ 
              ...prev, 
              ...docSnap.data() 
            }));
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
    };
    fetchUserData();
  }, [user]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await updateProfile(user, { photoURL: url });
      await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
      
      setPhotoURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user, { displayName: formData.displayName });
      
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber,
        paymentMethod: formData.paymentMethod,
        email: formData.email
      }, { merge: true });

      alert("Profile updated successfully!");
      setView('profile');
    } catch (err) {
      console.error(err);
      alert("Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile-page-root">
      <header className="zen-purple-header">
        <ArrowLeft className="header-icon-left" onClick={() => setView('profile')} />
        <h1 className="header-centered-title">Edit Profile</h1>
        <button 
          className="header-save-btn" 
          onClick={handleSave} 
          disabled={loading || uploading}
        >
          {loading ? '...' : 'Save'}
        </button>
      </header>

      <div className="white-content-area">
        <div className="avatar-section">
          <div className="avatar-wrapper">
            <img 
              src={photoURL || 'https://via.placeholder.com/100'} 
              alt="Avatar" 
              className={uploading ? 'img-uploading' : ''}
            />
            {uploading && (
              <div className="upload-loader">
                <Loader2 className="spin" size={30} color="white" />
              </div>
            )}
            <label htmlFor="fileInput" className="camera-icon-badge">
              <Camera size={18} color="white" />
              <input 
                id="fileInput" 
                type="file" 
                accept="image/*" 
                hidden 
                onChange={handleImageChange} 
              />
            </label>
          </div>
          {uploading && <p className="upload-status-text">Uploading...</p>}
        </div>

        <div className="edit-form-content">
          <div className="input-group">
            <label>Full Name</label>
            <input 
              type="text" 
              value={formData.displayName} 
              onChange={e => setFormData({...formData, displayName: e.target.value})} 
            />
          </div>
          
          <div className="input-group">
            <label>Phone Number</label>
            <input 
              type="text" 
              placeholder="+60..."
              value={formData.phoneNumber} 
              onChange={e => setFormData({...formData, phoneNumber: e.target.value})} 
            />
          </div>
          
          <div className="input-group">
            <label>Email (View Only)</label>
            <input 
              type="text" 
              value={formData.email} 
              disabled 
              className="disabled-input" 
            />
          </div>

          <div className="payment-preference">
            <h3>Payment Preference</h3>
            <div className="payment-options">
              {[
                { id: 'credit_card', name: 'Card', icon: <CreditCard size={20}/> },
                { id: 'tng', name: 'TNG', icon: <Wallet size={20}/> },
                { id: 'online_banking', name: 'FPX', icon: <Landmark size={20}/> }
              ].map(item => (
                <div 
                  key={item.id}
                  className={`pay-card ${formData.paymentMethod === item.id ? 'active' : ''}`}
                  onClick={() => setFormData({...formData, paymentMethod: item.id})}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="edit-footer-mascot">
            <img src={mascotImg} alt="mascot" />
        </div>
      </div>
    </div>
  );
};
