import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, updateUserProfile, resetData, deleteAccount } = useApp();
  
  // Local state for form inputs
  const [formData, setFormData] = useState({
    name: userProfile.name,
    email: userProfile.email
  });
  const [isSaved, setIsSaved] = useState(false);
  
  // Settings State
  const [biometricEnabled, setBiometricEnabled] = useState(() => {
    return localStorage.getItem('biometricLock') === 'true';
  });
  
  // Modals State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeletedSuccess, setShowDeletedSuccess] = useState(false);
  
  // Action Loading States
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [passwordData, setPasswordData] = useState({ 
    currentPass: '', 
    newPass: '', 
    confirmPass: '' 
  });
  const [authError, setAuthError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state if context changes
  useEffect(() => {
    setFormData(prev => ({
        ...prev,
        name: userProfile.name,
        email: userProfile.email
    }));
  }, [userProfile.name, userProfile.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    updateUserProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Open password modal
  const handleChangePasswordClick = () => {
    setShowPasswordModal(true);
    setPasswordData({ currentPass: '', newPass: '', confirmPass: '' });
    setAuthError(null);
  };

  // Danger Zone Handlers
  const handleResetClick = () => setShowResetModal(true);
  const handleDeleteClick = () => setShowDeleteModal(true);
  
  // Logout Handler
  const handleLogoutClick = () => setShowLogoutModal(true);

  const confirmLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem('token');
      localStorage.clear();
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      navigate(AppRoute.AUTH);
    }, 800);
  };

  const confirmReset = () => {
    setIsResetting(true);
    setTimeout(() => {
        resetData();
        setIsResetting(false);
        setShowResetModal(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    }, 1000);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    setAuthError(null);
    
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            setAuthError("Authentication token not found. Please log in again.");
            setIsDeleting(false);
            return;
        }

        const response = await fetch('http://127.0.0.1:8000/auth/delete-account', {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            localStorage.removeItem('token');
            localStorage.clear();
            setShowDeleteModal(false);
            setShowDeletedSuccess(true);
            
            setTimeout(() => {
                setShowDeletedSuccess(false);
                navigate(AppRoute.ONBOARDING);
            }, 2500);
            
        } else if (response.status === 401) {
            setAuthError("Session expired. Please log in again.");
            setTimeout(() => {
                localStorage.removeItem('token');
                setShowDeleteModal(false);
                navigate(AppRoute.AUTH);
            }, 2000);
        } else {
            const errorData = await response.json();
            setAuthError(errorData.detail || "Failed to delete account. Please try again.");
        }
    } catch (err) {
        console.error("Failed to delete from DB", err);
        setAuthError("Network error. Please check your connection and try again.");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleUpdatePassword = async () => {
    // Validation
    if (!passwordData.currentPass) {
        setAuthError("Please enter your current password");
        return;
    }

    if (!passwordData.newPass) {
        setAuthError("Please enter a new password");
        return;
    }

    if (passwordData.newPass.length < 6) {
        setAuthError("New password must be at least 6 characters");
        return;
    }

    if (passwordData.newPass !== passwordData.confirmPass) {
        setAuthError("New passwords do not match");
        return;
    }

    if (passwordData.currentPass === passwordData.newPass) {
        setAuthError("New password must be different from current password");
        return;
    }

    setIsUpdatingAuth(true);
    setAuthError(null);
    
    try {
        const response = await fetch('http://localhost:8000/auth/update-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                current_password: passwordData.currentPass,
                new_password: passwordData.newPass 
            })
        });

        if (response.ok) {
            setShowPasswordModal(false);
            setPasswordData({ currentPass: '', newPass: '', confirmPass: '' });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } else {
            const errorData = await response.json();
            // Show specific error for wrong current password
            if (response.status === 401) {
                setAuthError("Current password is incorrect");
            } else {
                setAuthError(errorData.detail || "Failed to update password");
            }
        }
    } catch (err) {
        setAuthError("Network error. Please try again.");
    } finally {
        setIsUpdatingAuth(false);
    }
  };

  const handleEditPictureClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
            updateUserProfile({ avatar: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleBiometric = async () => {
    const newValue = !biometricEnabled;
    setBiometricEnabled(newValue);
    localStorage.setItem('biometricLock', String(newValue));
    
    if (newValue) {
      alert("Biometric Lock enabled. This device will use Face ID/Touch ID when available.");
    } else {
      alert("Biometric Lock disabled.");
    }
  };

  return (
    <div className="pb-24 pt-4 px-5 max-w-md mx-auto relative">
      <header className="flex items-center justify-between mb-6 pt-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/5">
          <span className="material-symbols-outlined text-gray-400">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-white">Profile & Account</h1>
        <button 
            onClick={handleSave} 
            className={`font-medium text-sm transition-all duration-300 px-3 py-1 rounded-full ${isSaved ? 'bg-secondary text-white shadow-neon-green' : 'text-secondary hover:text-emerald-400 hover:bg-secondary/10'}`}
        >
            {isSaved ? 'Saved!' : 'Save'}
        </button>
      </header>

      <section className="flex flex-col items-center mb-8">
        <div className="relative mb-4 group cursor-pointer" onClick={handleEditPictureClick}>
            <div 
                className="h-24 w-24 rounded-full bg-cover bg-center border-4 border-background-card shadow-neon-green transition-opacity group-hover:opacity-80" 
                style={{backgroundImage: `url("${userProfile.avatar}")`}}
            ></div>
            <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-secondary text-background-dark flex items-center justify-center border-4 border-background-dark">
                <span className="material-symbols-outlined text-sm font-bold">edit</span>
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
            />
        </div>
        <p className="text-sm text-gray-400">Member since March 2023</p>
      </section>

      <div className="space-y-6">
        <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Personal Information</h2>
            <div className="glass-panel rounded-2xl p-4 space-y-4">
                <div className="space-y-1">
                    <label className="text-xs text-gray-400 ml-1">Full Name</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 text-lg">person</span>
                        <input 
                            type="text" 
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="w-full bg-background-dark/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-secondary outline-none transition-colors" 
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-gray-400 ml-1">Email</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500 text-lg">mail</span>
                        <input 
                            type="email" 
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full bg-background-dark/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white text-sm focus:border-secondary outline-none transition-colors" 
                        />
                    </div>
                </div>
            </div>
        </section>

        <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Security</h2>
            <div className="space-y-3">
                <button onClick={handleChangePasswordClick} className="w-full glass-panel rounded-xl p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">lock_reset</span>
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-semibold text-white">Change Password</p>
                            <p className="text-[10px] text-gray-400">Last updated 3 months ago</p>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-gray-500 group-hover:text-white transition-colors">chevron_right</span>
                </button>
                <div className="glass-panel rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                         <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors duration-300 ${biometricEnabled ? 'bg-green-500/20 text-green-500' : 'bg-gray-700/50 text-gray-500'}`}>
                            <span className="material-symbols-outlined">fingerprint</span>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white">Biometric Lock</p>
                            <p className="text-[10px] text-gray-400">
                                {biometricEnabled ? 'Active on this device' : 'Turn on for extra security'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={toggleBiometric}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${biometricEnabled ? 'bg-green-500' : 'bg-gray-700'}`}
                    >
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${biometricEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                    </button>
                </div>
            </div>
        </section>

        <div className="pt-4">
            <button 
                onClick={handleLogoutClick} 
                className="w-full glass-panel border border-gray-700 rounded-xl py-3 text-gray-400 text-sm font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
                <span className="material-symbols-outlined">logout</span> Log Out
            </button>
        </div>

        <section className="pt-8 pb-8 border-t border-white/5 mt-4">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 ml-1">Danger Zone</h2>
            <div className="space-y-3">
                <button onClick={handleResetClick} className="w-full glass-panel border border-orange-500/30 rounded-xl py-3 text-orange-400 text-sm font-bold hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">delete_history</span> Reset App Data
                </button>

                <button onClick={handleDeleteClick} className="w-full border border-red-500 bg-red-500/10 rounded-xl py-3 text-red-500 text-sm font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">no_accounts</span> Delete Account
                </button>
            </div>
        </section>
      </div>

      {/* Change Password Modal - UPDATED WITH CURRENT PASSWORD FIELD */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-card border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>
                <div className="space-y-4">
                    {authError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs flex items-center gap-2 animate-shake">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {authError}
                        </div>
                    )}
                    
                    {/* Current Password Field - NEW */}
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 ml-1">Current Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-background-dark/50 border border-gray-700 rounded-xl py-3 px-4 text-white text-sm focus:border-primary outline-none transition-colors"
                            value={passwordData.currentPass}
                            onChange={(e) => {
                                setPasswordData(prev => ({ ...prev, currentPass: e.target.value }));
                                if (authError) setAuthError(null);
                            }}
                            placeholder="Enter current password"
                        />
                    </div>

                    <div className="h-px bg-white/10 my-2"></div>

                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 ml-1">New Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-background-dark/50 border border-gray-700 rounded-xl py-3 px-4 text-white text-sm focus:border-primary outline-none transition-colors"
                            value={passwordData.newPass}
                            onChange={(e) => {
                                setPasswordData(prev => ({ ...prev, newPass: e.target.value }));
                                if (authError) setAuthError(null);
                            }}
                            placeholder="Min. 6 characters"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-400 ml-1">Confirm New Password</label>
                        <input 
                            type="password" 
                            className="w-full bg-background-dark/50 border border-gray-700 rounded-xl py-3 px-4 text-white text-sm focus:border-primary outline-none transition-colors"
                            value={passwordData.confirmPass}
                            onChange={(e) => {
                                setPasswordData(prev => ({ ...prev, confirmPass: e.target.value }));
                                if (authError) setAuthError(null);
                            }}
                            placeholder="Re-enter new password"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={() => {
                                setShowPasswordModal(false);
                                setAuthError(null);
                                setPasswordData({ currentPass: '', newPass: '', confirmPass: '' });
                            }}
                            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors"
                            disabled={isUpdatingAuth}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleUpdatePassword}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                            disabled={isUpdatingAuth}
                        >
                            {isUpdatingAuth ? (
                                <>
                                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    Updating
                                </>
                            ) : 'Update'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-card border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                         <span className="material-symbols-outlined text-primary text-2xl">logout</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">Log Out?</h3>
                    <p className="text-sm text-gray-400 mt-2">
                        Are you sure you want to log out of your account?
                    </p>
                </div>
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => setShowLogoutModal(false)}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors"
                        disabled={isLoggingOut}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmLogout}
                        className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut ? (
                            <>
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Logging out...
                            </>
                        ) : 'Log Out'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Reset Data Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-card border border-orange-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                         <span className="material-symbols-outlined text-orange-500 text-2xl">warning</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">Reset App Data?</h3>
                    <p className="text-sm text-gray-400 mt-2">
                        This will delete all your local history logs and habit tracking progress. Your profile settings will remain.
                    </p>
                </div>
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => setShowResetModal(false)}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors"
                        disabled={isResetting}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmReset}
                        className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                        disabled={isResetting}
                    >
                        {isResetting ? (
                            <>
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Resetting
                            </>
                        ) : 'Reset Data'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-card border border-red-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                         <span className="material-symbols-outlined text-red-500 text-2xl">delete_forever</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">Delete Account?</h3>
                    <p className="text-sm text-gray-400 mt-2">
                        This action is irreversible. All your data, habits, and profile information will be permanently erased.
                    </p>
                    
                    {authError && (
                        <div className="mt-4 w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {authError}
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => {
                            setShowDeleteModal(false);
                            setAuthError(null);
                        }}
                        className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Deleting
                            </>
                        ) : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Account Deleted Success Modal */}
      {showDeletedSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-background-card border border-secondary/30 rounded-2xl w-full max-w-sm p-8 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 text-center">
                <div className="h-16 w-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-secondary text-3xl">check_circle</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Account Deleted</h3>
                <p className="text-sm text-gray-400 mb-6">
                    Your account and all data have been permanently removed.
                </p>
                <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-secondary animate-[shrink_2.5s_linear_forwards]"></div>
                </div>
                <p className="text-xs text-gray-500 mt-3">Redirecting to onboarding...</p>
            </div>
        </div>
      )}
    </div>
  );
};

export default Profile;