import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { communityService, CommunityPost, CommunityComment } from '../lib/communityService';
import { leaderboardService } from '../lib/leaderboardService';
import { userStatisticsService } from '../lib/userStatisticsService';
import { userSkillAchievementService } from '../lib/userSkillAchievementService';
import PublicProfileModal from '../components/PublicProfileModal';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

const CommunityPage: React.FC = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [topLearners, setTopLearners] = useState<any[]>([]);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state for image upload and emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Menu and Edit states
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Public Profile Modal
  const [showPublicProfile, setShowPublicProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Pagination states
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const POSTS_PER_PAGE = 10;

  // Scroll and Editor collapse states
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const handleLinkedInClick = () => {
    if (userProfile?.linkedin_profile_url) {
      window.open(userProfile.linkedin_profile_url, '_blank', 'noopener noreferrer');
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 100) {
        if (currentScrollY > lastScrollY) {
          setIsEditorCollapsed(true);
        } else {
          setIsEditorCollapsed(false);
        }
      }
      // If we're at the very top, keep current state (usually collapsed by default now)
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        setLoadingError(null);
        console.log('🔄 Community Page: Starting data fetch...');

        // Fetch user profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('fullname, designation, avatarurl, linkedin_profile_url')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('❌ Profile fetch error:', error);
          throw new Error(`Profile error: ${error.message}`);
        }
        setUserProfile(profile);
        console.log('✅ Profile loaded');

        // Fetch user stats
        const stats = await userStatisticsService.getUserStatistics(user.id);
        setUserStats(stats);
        console.log('✅ User stats loaded:', stats?.totalpoints || 0, 'points');

        // Fetch posts with error handling
        console.log('🔄 Fetching community posts...');
        const fetchedPosts = await communityService.getPosts(user.id, undefined, POSTS_PER_PAGE, 0);
        console.log('✅ Posts loaded:', fetchedPosts.length, 'posts');
        setPosts(fetchedPosts);
        setOffset(POSTS_PER_PAGE);
        setHasMore(fetchedPosts.length === POSTS_PER_PAGE);

        // Fetch leaderboard
        console.log('🔄 Fetching leaderboard...');
        const leaderboard = await leaderboardService.getTopUsers(3);
        console.log('✅ Leaderboard loaded:', leaderboard.length, 'users');
        setTopLearners(leaderboard);

        // Fetch user badges
        const badges = await userSkillAchievementService.getUserBadges(user.id);
        setUserBadges(badges);
        console.log('✅ Badges loaded:', badges.length, 'badges');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load community data';
        console.error('❌ Community page error:', error);
        setLoadingError(errorMessage);

        // Set partial data where possible
        setPosts([]);
        setTopLearners([]);
        setUserStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const handleCreatePost = async () => {
    if ((!newPostContent.trim() && !selectedFile) || !user || !userProfile) return;

    try {
      setIsUploading(true);
      let imageUrl = undefined;

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('community-uploads')
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          alert('Failed to upload image. Please try again.');
          setIsUploading(false);
          return;
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('community-uploads')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const newPost = await communityService.createPost({
        userId: user.id,
        userName: userProfile.fullname || 'User',
        userAvatar: userProfile.avatarurl,
        title: 'Community Post',
        content: newPostContent,
        imageUrl: imageUrl,
        category: 'general',
        views: 0,
        likes: 0
      });

      if (newPost) {
        setPosts([newPost, ...posts]);
        setNewPostContent('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setShowEmojiPicker(false);
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore || !user?.id) return;

    try {
      setIsFetchingMore(true);
      const nextPosts = await communityService.getPosts(user.id, undefined, POSTS_PER_PAGE, offset);

      if (nextPosts.length > 0) {
        setPosts(prev => [...prev, ...nextPosts]);
        setOffset(prev => prev + POSTS_PER_PAGE);
        setHasMore(nextPosts.length === POSTS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching more posts:', error);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;
    try {
      const updatedPost = await communityService.likePost(postId, user.id);
      if (updatedPost) {
        setPosts(posts.map(p => p.id === postId ? updatedPost : p));
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const toggleComments = async (postId: string) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
    } else {
      setActiveCommentPostId(postId);
      if (!comments[postId]) {
        const postComments = await communityService.getPostComments(postId);
        setComments(prev => ({ ...prev, [postId]: postComments }));
      }
    }
  };

  const handleCreateComment = async (postId: string) => {
    const content = newCommentContent[postId];
    if (!content?.trim() || !user || !userProfile) return;

    try {
      const newComment = await communityService.createComment({
        postId,
        userId: user.id,
        userName: userProfile.fullname || 'User',
        userAvatar: userProfile.avatarurl,
        content: content,
        likes: 0
      });

      if (newComment) {
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newComment]
        }));
        setNewCommentContent(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setNewPostContent(prev => prev + emojiData.emoji);
    // Don't close picker to allow multiple emojis
  };

  const handleUpdatePost = async (postId: string) => {
    if (!editContent.trim()) return;
    try {
      const updatedPost = await communityService.updatePost(postId, { content: editContent });
      if (updatedPost) {
        setPosts(posts.map(p => p.id === postId ? { ...p, content: editContent } : p));
        setEditingPostId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Error updating post:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await communityService.deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  const handleSharePost = (post: CommunityPost) => {
    const textToShare = `${post.userName} posted: ${post.content}`;
    navigator.clipboard.writeText(textToShare).then(() => {
      alert('Post content copied to clipboard!');
    });
    setActiveMenuPostId(null);
  };

  const openPublicProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowPublicProfile(true);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="w-full pb-24 lg:pb-0">
      {/* Error Banner */}
      {loadingError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-100">Failed to Load Community</h3>
              <p className="text-sm text-red-700 dark:text-red-200 mt-1">{loadingError}</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-2">Check console for details. If you see a 403 error, please refresh the page.</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-3 lg:col-span-2 flex flex-col gap-6">
          {/* Create Post - Desktop Only (sticky top) */}
          <div className={`hidden lg:block bg-white dark:bg-neutral-dark rounded-md shadow-sm transition-all duration-300 overflow-hidden ${isEditorCollapsed ? 'h-16' : 'p-6'
            } sticky top-4 z-30`}>
            {isEditorCollapsed ? (
              <div className="flex items-center justify-between h-16 px-6">
                <div className="flex items-center gap-3">
                  <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url("${userProfile?.avatarurl || userProfile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}")` }} />
                  <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary truncate max-w-[200px]">Share something...</p>
                </div>
                <button
                  onClick={() => setIsEditorCollapsed(false)}
                  className="bg-indigo-600 text-white rounded-full size-10 flex items-center justify-center hover:bg-primary-700 transition-colors shadow-md"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12" style={{ backgroundImage: `url("${userProfile?.avatarurl || userProfile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}")` }} />
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="form-textarea w-full resize-none bg-neutral-light dark:bg-background-dark border-border-light dark:border-border-dark rounded p-4 h-24 focus:ring-primary focus:border-primary placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary"
                      placeholder="Share something with your community..."
                    />
                    {previewUrl && (
                      <div className="relative w-fit">
                        <img src={previewUrl} alt="Preview" className="max-h-48 rounded border border-slate-200" />
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-4 text-text-light-secondary dark:text-text-dark-secondary relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    <button onClick={handleFileUpload} className="hover:text-primary transition-colors" title="Upload Image">
                      <span className="material-symbols-outlined">image</span>
                    </button>
                    <button onClick={handleFileUpload} className="hover:text-primary transition-colors" title="Attach File">
                      <span className="material-symbols-outlined">attach_file</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`hover:text-primary transition-colors ${showEmojiPicker ? 'text-primary' : ''}`}
                        title="Add Emoji"
                      >
                        <span className="material-symbols-outlined">emoji_emotions</span>
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute top-10 left-0 z-50 shadow-xl rounded-xl">
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowEmojiPicker(false)}
                          />
                          <div className="relative z-50">
                            <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={400} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditorCollapsed(true)}
                      className="px-4 py-2 text-sm text-text-light-secondary hover:text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePost}
                      disabled={(!newPostContent.trim() && !selectedFile) || isUploading}
                      className={`flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded h-10 px-6 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors ${(!newPostContent.trim() && !selectedFile) || isUploading
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-primary-700'
                        }`}
                    >
                      {isUploading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="truncate">Post</span>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-6">


            {/* Dynamic Posts */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-slate-500">Loading posts...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-md shadow-sm">
                <p className="text-slate-500">No posts yet. Be the first to share!</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-white dark:bg-neutral-dark rounded-md p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div
                      className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundImage: `url("${post.userAvatar || `https://i.pravatar.cc/150?u=${post.userId}`}")` }}
                      onClick={() => openPublicProfile(post.userId)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className="font-semibold cursor-pointer hover:text-primary transition-colors"
                            onClick={() => openPublicProfile(post.userId)}
                          >
                            {post.userName}
                          </p>
                          <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">{formatTimeAgo(post.createdAt)}</p>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id)}
                            className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary"
                          >
                            <span className="material-symbols-outlined">more_horiz</span>
                          </button>

                          {activeMenuPostId === post.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActiveMenuPostId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 w-32  bg-white rounded shadow-lg border border-[#4f46e5] z-20 overflow-hidden">
                                {user?.id === post.userId && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingPostId(post.id);
                                        setEditContent(post.content);
                                        setActiveMenuPostId(null);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-slate-700 dark:text-slate-800"
                                    >
                                      <span className="material-symbols-outlined text-base">edit</span>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeletePost(post.id)}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-neutral-700 text-red-500 flex items-center gap-2"
                                    >
                                      <span className="material-symbols-outlined text-base">delete</span>
                                      Delete
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => handleSharePost(post)}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-neutral-700 flex items-center gap-2 text-slate-700 dark:text-slate-800"
                                >
                                  <span className="material-symbols-outlined text-base">share</span>
                                  Share
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {editingPostId === post.id ? (
                        <div className="mt-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-2 border rounded bg-slate-50 dark:bg-neutral-800 dark:border-neutral-700 resize-none focus:ring-2 focus:ring-primary/50 outline-none text-slate-900 dark:text-slate-100"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={() => setEditingPostId(null)}
                              className="px-3 py-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleUpdatePost(post.id)}
                              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-primary-700 transition-colors"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                      )}
                      {post.imageUrl && (
                        <div className="mt-3">
                          <img src={post.imageUrl} alt="Post attachment" className="rounded max-h-96 w-auto max-w-full object-contain" />

                        </div>
                      )}
                    </div>
                  </div>

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 mt-4 pl-16 text-text-light-secondary dark:text-text-dark-secondary border-b border-slate-100 pb-4 mb-4">
                    <button
                      onClick={() => handleLikePost(post.id)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <span className={`material-symbols-outlined text-xl ${post.isLiked ? 'text-red-500 icon-filled' : ''}`}>favorite</span>
                      <span className="text-sm font-medium">{post.likes} Likes</span>
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center gap-1.5 hover:text-primary transition-colors ${activeCommentPostId === post.id ? 'text-primary' : ''}`}
                    >
                      <span className="material-symbols-outlined text-xl">chat_bubble</span>
                      <span className="text-sm font-medium">Comments</span>
                    </button>
                    <button
                      onClick={() => handleSharePost(post)}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">share</span>
                      <span className="text-sm font-medium">Share</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {activeCommentPostId === post.id && (
                    <div className="pl-16 space-y-4">
                      {/* Comment List */}
                      <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <img
                              src={comment.userAvatar || `https://i.pravatar.cc/150?u=${comment.userId}`}
                              alt={comment.userName}
                              className="w-8 h-8 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => openPublicProfile(comment.userId)}
                            />
                            <div className="bg-slate-50 rounded p-3 flex-1">
                              <div className="flex justify-between items-start">
                                <span
                                  className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => openPublicProfile(comment.userId)}
                                >
                                  {comment.userName}
                                </span>
                                <span className="text-xs text-slate-400">{formatTimeAgo(comment.createdAt)}</span>
                              </div>
                              <p className="text-sm text-slate-700 mt-1">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Comment Input */}
                      <div className="flex gap-3 items-start mt-4">
                        <img
                          src={userProfile?.avatarurl || userProfile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}
                          alt="My Avatar"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={newCommentContent[post.id] || ''}
                            onChange={(e) => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Write a comment..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleCreateComment(post.id);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleCreateComment(post.id)}
                            disabled={!newCommentContent[post.id]?.trim()}
                            className="p-2 text-primary hover:bg-primary/10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="material-symbols-outlined">send</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Pagination / Load More */}
            {hasMore && posts.length > 0 && (
              <div className="flex justify-center mt-4 pb-8">
                <button
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="px-6 py-2 bg-white dark:bg-neutral-dark border border-border-light dark:border-border-dark rounded-full text-sm font-semibold text-primary hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isFetchingMore ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : (
                    'Load More Posts'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-3 lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          {/* User Profile Card */}
          <div className="bg-white dark:bg-neutral-dark rounded-xl p-6 shadow-sm text-center">
            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-20 mx-auto relative" style={{ backgroundImage: `url("${userProfile?.avatarurl || userProfile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}")` }}>
              {userBadges.find(b => b.isEFSET) && (
                <div
                  className="absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white shadow-sm flex items-center justify-center"
                  style={{ backgroundColor: userBadges.find(b => b.isEFSET).color }}
                  title={`EFSET Rank: ${userBadges.find(b => b.isEFSET).cefr}`}
                >
                  <span className="material-symbols-rounded text-white text-[12px] font-bold">
                    {userBadges.find(b => b.isEFSET).icon}
                  </span>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-lg mt-4 font-heading">{userProfile?.fullname || 'User'}</h3>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm text-primary font-medium">{(userStats?.totalpoints || (userStats?.coursescompleted || 0) * 100).toLocaleString()} Points</p>
              {userBadges.find(b => b.isEFSET) && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: userBadges.find(b => b.isEFSET).color }}
                >
                  EFSET: {userBadges.find(b => b.isEFSET).cefr} ({userBadges.find(b => b.isEFSET).score})
                </span>
              )}
            </div>
            {userProfile?.linkedin_profile_url && (
              <button
                onClick={handleLinkedInClick}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                type="button"
              >
                <FaIcons.FaLinkedin className="h-4 w-4 text-sky-600" />
                <span className="text-xs font-semibold">LinkedIn Profile</span>
              </button>
            )}

            <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-border-light dark:border-border-dark">
              <div className="text-center px-4 border-r border-border-light dark:border-border-dark">
                <p className="text-lg font-bold text-slate-800">{userStats?.coursescompleted || 0}</p>
                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Courses</p>
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-medium text-slate-800 mt-1">{userProfile?.designation || 'Student'}</p>
                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">Designation</p>
              </div>
            </div>
          </div>

          {/* My Achievements - Dynamic */}
          <div className="bg-white dark:bg-neutral-dark rounded-xl p-6 shadow-sm">
            <h4 className="font-semibold font-heading">My Achievements</h4>
            {userBadges.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 mt-4">
                {userBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center text-center gap-2">
                    <div
                      className="p-3 rounded-full"
                      style={{
                        backgroundColor: badge.isEFSET ? `${badge.color}20` : 'rgba(79, 70, 229, 0.1)',
                        color: badge.isEFSET ? badge.color : 'rgb(79, 70, 229)'
                      }}
                    >
                      {badge.isEFSET ? (
                        <span className="material-symbols-rounded text-3xl">{badge.icon}</span>
                      ) : badge.icon && (FaIcons as any)[badge.icon] ? (
                        React.createElement((FaIcons as any)[badge.icon], { size: 24 })
                      ) : badge.icon && (MdIcons as any)[badge.icon] ? (
                        React.createElement((MdIcons as any)[badge.icon], { size: 24 })
                      ) : (
                        <span className="material-symbols-outlined text-3xl">workspace_premium</span>
                      )}
                    </div>
                    <p className="text-xs leading-tight font-medium">{badge.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-500">Complete more courses to earn a badge!</p>
              </div>
            )}
          </div>

          {/* Leaderboard - Dynamic */}
          <div className="bg-white dark:bg-neutral-dark rounded-xl p-6 shadow-sm">
            <h4 className="font-semibold font-heading">Leaderboard</h4>
            <div className="flex items-center gap-2 bg-neutral-light dark:bg-background-dark p-1 rounded-lg mt-4 text-sm">
              <button className="flex-1 py-1.5 rounded bg-white dark:bg-neutral-dark shadow-sm text-primary font-semibold">All Time</button>
            </div>
            <ul className="space-y-4 mt-4">
              {topLearners.length > 0 ? (
                topLearners.map((learner, index) => {
                  const profile = learner.profiles;
                  const name = profile?.fullname || learner.username;
                  const avatar = profile?.avatarurl || learner.useravatar || `https://i.pravatar.cc/150?u=${learner.userid}`;

                  return (
                    <li key={learner.userid} className="flex items-center gap-3">
                      <p className={`font-bold text-lg ${index === 0 ? 'text-accent-1' : 'text-text-light-secondary dark:text-text-dark-secondary'}`}>{index + 1}</p>
                      <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundImage: `url("${avatar}")` }}
                        onClick={() => openPublicProfile(learner.userid)}
                      />
                      <div className="flex-1">
                        <p
                          className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                          onClick={() => openPublicProfile(learner.userid)}
                        >
                          {name}
                        </p>
                        <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">{profile?.department || 'Student'}</p>
                      </div>
                      <p className={`text-sm font-bold ${index === 0 ? 'text-accent-1' : 'text-text-light-primary dark:text-text-dark-primary'}`}>{learner.totalpoints} XP</p>
                    </li>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 text-center">No leaderboard data available</p>
              )}
            </ul>
          </div>
        </div>
      </div>

      {showPublicProfile && selectedUserId && (
        <PublicProfileModal
          userId={selectedUserId}
          onClose={() => setShowPublicProfile(false)}
        />
      )}

      {/* Mobile Create Post - Sticky Bottom */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 transform ${isEditorCollapsed ? 'translate-y-0' : 'translate-y-0'
        }`}>
        <div className={`bg-white dark:bg-neutral-dark shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t border-slate-100 dark:border-neutral-800 transition-all duration-300 overflow-hidden ${isEditorCollapsed ? 'h-20' : 'h-screen md:h-auto md:max-h-[80vh] rounded-t-2xl'
          }`}>
          {isEditorCollapsed ? (
            <div className="flex items-center justify-between h-20 px-6">
              <div className="flex items-center gap-3" onClick={() => setIsEditorCollapsed(false)}>
                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url("${userProfile?.avatarurl || userProfile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}")` }} />
                <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Share something...</p>
              </div>
              <button
                onClick={() => setIsEditorCollapsed(false)}
                className="bg-indigo-600 text-white rounded-full size-12 flex items-center justify-center hover:bg-primary-700 transition-colors shadow-lg active:scale-95"
              >
                <span className="material-symbols-outlined text-2xl">add</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Mobile Create Post Header - Sticky */}
              <div className="fixed top-14 left-0 right-0 bg-white dark:bg-neutral-dark border-b border-slate-100 dark:border-neutral-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-50 shrink-0 lg:hidden">
                <h3 className="font-bold text-base sm:text-lg">Create Post</h3>
                <button
                  onClick={() => setIsEditorCollapsed(true)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors active:scale-95 flex items-center justify-center min-w-10 min-h-10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  aria-label="Close post editor"
                  title="Close post editor"
                >
                  <span className="material-symbols-outlined text-xl font-bold">close</span>
                </button>
              </div>

              <div className="pt-36 sm:pt-20 p-4 sm:p-6 pb-10 flex flex-col flex-1 overflow-y-auto">
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10" style={{ backgroundImage: `url("${userProfile?.avatarurl || userProfile?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`}")` }} />
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="form-textarea w-full resize-none bg-neutral-light dark:bg-background-dark border-border-light dark:border-border-dark rounded-xl p-4 h-60 focus:ring-primary focus:border-primary placeholder:text-text-light-secondary dark:placeholder:text-text-dark-secondary text-base"
                      placeholder="What's on your mind?"
                      autoFocus
                    />
                    {previewUrl && (
                      <div className="relative w-fit mt-2">
                        <img src={previewUrl} alt="Preview" className="max-h-60 rounded-xl border border-slate-200" />
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewUrl(null);
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center mt-auto pt-6 border-t border-slate-100 dark:border-neutral-800">
                  <div className="flex items-center gap-6 text-text-light-secondary dark:text-text-dark-secondary">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    <button onClick={handleFileUpload} className="p-2 hover:text-primary transition-colors flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined text-2xl">image</span>
                      <span className="text-[10px]">Photo</span>
                    </button>
                    <button onClick={handleFileUpload} className="p-2 hover:text-primary transition-colors flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined text-2xl">attach_file</span>
                      <span className="text-[10px]">File</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2 hover:text-primary transition-colors flex flex-col items-center gap-1 ${showEmojiPicker ? 'text-primary' : ''}`}
                      >
                        <span className="material-symbols-outlined text-2xl">emoji_emotions</span>
                        <span className="text-[10px]">Emoji</span>
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-16 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowEmojiPicker(false)}
                          />
                          <div className="relative z-50">
                            <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={350} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleCreatePost();
                      setIsEditorCollapsed(true);
                    }}
                    disabled={(!newPostContent.trim() && !selectedFile) || isUploading}
                    className={`flex min-w-[100px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-12 px-6 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-all active:scale-95 ${(!newPostContent.trim() && !selectedFile) || isUploading
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
                      }`}
                  >
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="truncate">Post</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
