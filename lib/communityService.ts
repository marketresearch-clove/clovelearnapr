import { supabase } from './supabaseClient';

export interface CommunityPost {
  id: string;
  courseId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  content: string;
  imageUrl?: string;
  category: string;
  views: number;
  likes: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  likes: number;
  createdAt: string;
  updatedAt: string;
}

export const communityService = {
  // Posts Management
  async getPosts(userId?: string, courseId?: string, limit = 10, offset = 0) {
    try {
      let query = supabase.from('community_posts').select('*');

      if (courseId) {
        query = query.eq('courseid', courseId);
      }

      const { data: posts, error } = await query
        .order('createdat', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Fetch fresh user profile data for all posts
      const userIds = (posts || []).map(p => p.userid).filter(Boolean);
      let userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, fullname, avatarurl, avatar_url')
          .in('id', userIds);

        if (profiles) {
          profiles.forEach(profile => {
            userProfiles[profile.id] = profile;
          });
        }
      }

      // Fetch like counts and user's liked status
      const postIds = (posts || []).map(p => p.id);
      let likedPostIds = new Set<string>();
      let likeCounts: Record<string, number> = {};

      if (postIds.length > 0) {
        // Fetch user's liked status if userId is provided
        if (userId) {
          const { data: likes } = await supabase
            .from('community_likes')
            .select('postid')
            .eq('userid', userId)
            .in('postid', postIds);

          if (likes) {
            likes.forEach(l => likedPostIds.add(l.postid));
          }
        }

        // Fetch actual like counts from community_likes table
        const { data: allLikes } = await supabase
          .from('community_likes')
          .select('postid')
          .in('postid', postIds);

        if (allLikes) {
          allLikes.forEach(l => {
            likeCounts[l.postid] = (likeCounts[l.postid] || 0) + 1;
          });
        }
      }

      return (posts || []).map(post => {
        const userProfile = userProfiles[post.userid];
        return {
          id: post.id,
          userId: post.userid,
          userName: userProfile?.fullname || post.username,
          userAvatar: userProfile?.avatarurl || userProfile?.avatar_url || post.useravatar,
          title: post.title,
          content: post.content,
          imageUrl: post.image_url,
          category: post.category,
          views: post.views,
          likes: likeCounts[post.id] || 0,
          isLiked: likedPostIds.has(post.id),
          createdAt: post.createdat,
          updatedAt: post.updatedat
        };
      });
    } catch (error) {
      console.error('Error fetching posts:', error);
      return [];
    }
  },

  async getPostById(postId: string) {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  },

  async createPost(post: Omit<CommunityPost, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      // Fetch fresh user profile data
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('fullname, avatarurl, avatar_url')
        .eq('id', post.userId)
        .single();

      // Use fresh profile data instead of passed data
      const userName = userProfile?.fullname || post.userName;
      const userAvatar = userProfile?.avatarurl || userProfile?.avatar_url || post.userAvatar;

      // Map camelCase to snake_case for database
      const dbPost = {
        userid: post.userId,
        username: userName,
        useravatar: userAvatar,
        title: post.title,
        content: post.content,
        image_url: post.imageUrl,
        category: post.category,
        views: post.views,
        likes: post.likes
      };

      const { data, error } = await supabase
        .from('community_posts')
        .insert([dbPost])
        .select()
        .single();

      if (error) throw error;

      // Map back to camelCase for frontend
      return {
        id: data.id,
        userId: data.userid,
        userName: userName,
        userAvatar: userAvatar,
        title: data.title,
        content: data.content,
        imageUrl: data.image_url,
        category: data.category,
        views: data.views,
        likes: data.likes,
        createdAt: data.createdat,
        updatedAt: data.updatedat
      };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  async updatePost(postId: string, updates: Partial<CommunityPost>) {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .update(updates)
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  async deletePost(postId: string) {
    try {
      const { error } = await supabase
        .from('community_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  async likePost(postId: string, userId: string) {
    try {
      // Check if already liked
      const { data: existingLike } = await supabase
        .from('community_likes')
        .select('id')
        .eq('postid', postId)
        .eq('userid', userId)
        .maybeSingle();

      let isLiked = false;

      if (existingLike) {
        // Unlike
        await supabase
          .from('community_likes')
          .delete()
          .eq('id', existingLike.id);
        isLiked = false;
      } else {
        // Like
        await supabase
          .from('community_likes')
          .insert([{ postid: postId, userid: userId }]);
        isLiked = true;
      }

      // Fetch the updated post and actual like count
      const post = await this.getPostById(postId);
      if (!post) throw new Error('Post not found');

      const { count } = await supabase
        .from('community_likes')
        .select('*', { count: 'exact', head: true })
        .eq('postid', postId);

      // Fetch fresh user profile data
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('fullname, avatarurl, avatar_url')
        .eq('id', post.userid)
        .single();

      return {
        id: post.id,
        userId: post.userid,
        userName: userProfile?.fullname || post.username,
        userAvatar: userProfile?.avatarurl || userProfile?.avatar_url || post.useravatar,
        title: post.title,
        content: post.content,
        imageUrl: post.image_url,
        category: post.category,
        views: post.views,
        likes: count || 0,
        isLiked: isLiked,
        createdAt: post.createdat,
        updatedAt: post.updatedat
      };
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  },

  // Comments Management
  async getPostComments(postId: string) {
    try {
      const { data, error } = await supabase
        .from('community_comments')
        .select('*')
        .eq('postid', postId)
        .order('createdat', { ascending: true });

      if (error) throw error;

      // Fetch fresh user profile data for all comments
      const userIds = (data || []).map(c => c.userid).filter(Boolean);
      let userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, fullname, avatarurl, avatar_url')
          .in('id', userIds);

        if (profiles) {
          profiles.forEach(profile => {
            userProfiles[profile.id] = profile;
          });
        }
      }

      return (data || []).map(comment => {
        const userProfile = userProfiles[comment.userid];
        return {
          id: comment.id,
          postId: comment.postid,
          userId: comment.userid,
          userName: userProfile?.fullname || comment.username,
          userAvatar: userProfile?.avatarurl || userProfile?.avatar_url || comment.useravatar,
          content: comment.content,
          likes: comment.likes,
          createdAt: comment.createdat,
          updatedAt: comment.updatedat
        };
      });
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  },

  async createComment(comment: Omit<CommunityComment, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      // Fetch fresh user profile data
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('fullname, avatarurl, avatar_url')
        .eq('id', comment.userId)
        .single();

      // Use fresh profile data instead of passed data
      const userName = userProfile?.fullname || comment.userName;
      const userAvatar = userProfile?.avatarurl || userProfile?.avatar_url || comment.userAvatar;

      const dbComment = {
        postid: comment.postId,
        userid: comment.userId,
        username: userName,
        useravatar: userAvatar,
        content: comment.content,
        likes: comment.likes
      };

      const { data, error } = await supabase
        .from('community_comments')
        .insert([dbComment])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        postId: data.postid,
        userId: data.userid,
        userName: userName,
        userAvatar: userAvatar,
        content: data.content,
        likes: data.likes,
        createdAt: data.createdat,
        updatedAt: data.updatedat
      };
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  },

  async deleteComment(commentId: string) {
    try {
      const { error } = await supabase
        .from('community_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  },

  async likeComment(commentId: string) {
    try {
      const { data: comment, error: fetchError } = await supabase
        .from('community_comments')
        .select('likes')
        .eq('id', commentId)
        .single();

      if (fetchError) throw fetchError;

      const { data, error } = await supabase
        .from('community_comments')
        .update({ likes: (comment.likes || 0) + 1 })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error liking comment:', error);
      throw error;
    }
  },

  async searchPosts(query: string) {
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching posts:', error);
    return [];
  }
},
};
