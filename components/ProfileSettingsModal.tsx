import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../lib/userService';
import { supabase } from '../lib/supabaseClient';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'certificates'>('profile');
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [profile, setProfile] = useState<any>({
    fullname: '',
    email: '',
    department: '',
    mobile_number: '',
    user_id: '',
    designation: '',
    linkedin_profile_url: '',
    avatarurl: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchProfile();
      if (activeTab === 'certificates') {
        fetchCertificates();
      }
    }
  }, [isOpen, user?.id, activeTab]);

  const fetchCertificates = async () => {
    if (!user?.id) return;
    setLoadingCerts(true);
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id,
          issued_at,
          course_id,
          courses:course_id (
            id,
            title,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error fetching certificates:', error);
    } finally {
      setLoadingCerts(false);
    }
  };

  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await userService.getUserProfile(user.id);
      if (data) {
        setProfile({
          fullname: data.fullname || '',
          email: data.email || user.email || '',
          department: data.department || '',
          mobile_number: data.mobile_number || '',
          user_id: data.user_id || '',
          designation: data.designation || '',
          linkedin_profile_url: data.linkedin_profile_url || '',
          avatarurl: data.avatarurl || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    setUploading(true);
    try {
      // Upload image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile((prev: any) => ({ ...prev, avatarurl: publicUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    try {
      await userService.updateUserProfile(user.id, {
        fullname: profile.fullname,
        department: profile.department,
        mobile_number: profile.mobile_number,
        user_id: profile.user_id,
        designation: profile.designation,
        linkedin_profile_url: profile.linkedin_profile_url,
        avatarurl: profile.avatarurl
      });
      onClose();
      // Optionally trigger a refresh in parent or context
      window.location.reload(); // Simple way to refresh header
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Profile Settings</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${activeTab === 'profile'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Profile
          </button>
          <button
            onClick={() => {
              setActiveTab('certificates');
              if (certificates.length === 0 && !loadingCerts) {
                fetchCertificates();
              }
            }}
            className={`flex-1 py-3 px-4 font-medium text-sm transition-colors ${activeTab === 'certificates'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            Certificates
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === 'profile' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-24 h-24 mb-2">
                  <img
                    src={profile.avatarurl || `https://i.pravatar.cc/150?u=${user?.id}`}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover border-4 border-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-indigo-600 text-white p-1.5 rounded-full hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    <span className="material-symbols-rounded text-sm">edit</span>
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
                <p className="text-xs text-gray-500">Click edit icon to change photo</p>
                {uploading && <p className="text-xs text-indigo-600 mt-1">Uploading...</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  name="fullname"
                  value={profile.fullname}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    name="department"
                    value={profile.department}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={profile.designation}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    name="mobile_number"
                    value={profile.mobile_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                  <input
                    type="text"
                    name="user_id"
                    value={profile.user_id}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Profile URL</label>
                <input
                  type="url"
                  name="linkedin_profile_url"
                  value={profile.linkedin_profile_url}
                  onChange={handleInputChange}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || uploading}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {loadingCerts ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : certificates.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-rounded text-4xl text-gray-300 mb-2">card_membership</span>
                  <p className="text-gray-600">No certificates yet</p>
                  <p className="text-sm text-gray-500 mt-1">Complete courses with certificates enabled to earn them</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certificates.map((cert: any) => (
                    <div key={cert.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{cert.courses?.title || 'Certificate'}</h4>
                          <p className="text-sm text-gray-600 mt-1">{cert.courses?.category || 'General'}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            Issued: {new Date(cert.issued_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // Certificate download/view functionality can be added here
                            alert('Certificate download coming soon!');
                          }}
                          className="ml-2 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-rounded">download</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsModal;