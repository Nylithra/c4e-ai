import { Community, Post, UserProfile } from '../types';
import { verifyAdminAccess } from './securityHelper';

/**
 * Visibility rules for private ("gizli") communities.
 *
 * A private community stays discoverable — anyone can find it and ask to join — but its
 * posts are only listed for members. This module is the single place the client asks
 * "may this person see this post?", so the feed, explore, bookmarks and profile timelines
 * all behave the same way.
 *
 * NOTE: this is a presentation filter. The real enforcement is the `posts` SELECT policy in
 * supabase_schema.sql, which hides private community rows from non-members at the database
 * level. Never rely on this function alone for privacy.
 */

export function isCommunityMember(community: Community | null | undefined, user?: UserProfile | null): boolean {
  if (!community || !user) return false;
  if (community.is_joined) return true;
  if ((user.joined_communities || []).includes(community.id)) return true;
  if (community.created_by && community.created_by === user.id) return true;
  if (
    community.creator_username &&
    community.creator_username.toLowerCase() === (user.username || '').toLowerCase()
  ) {
    return true;
  }
  return false;
}

/** Finds the community a post belongs to (id first, then handle, then legacy name). */
export function findPostCommunity(post: Post, communities: Community[] = []): Community | null {
  if (!post.community_id && !post.community_handle && !post.community_name) return null;

  const byId = post.community_id ? communities.find((c) => c.id === post.community_id) : undefined;
  if (byId) return byId;

  const postHandle = (post.community_handle || '').replace(/^@/, '').toLowerCase();
  if (postHandle) {
    const byHandle = communities.find((c) => (c.handle || '').replace(/^@/, '').toLowerCase() === postHandle);
    if (byHandle) return byHandle;
  }

  const postName = (post.community_name || '').toLowerCase();
  if (postName) {
    const byName = communities.find((c) => (c.name || '').toLowerCase() === postName);
    if (byName) return byName;
  }

  return null;
}

/** True when the given user is allowed to see this post in a timeline. */
export function canViewPost(post: Post, user?: UserProfile | null, communities: Community[] = []): boolean {
  const community = findPostCommunity(post, communities);
  if (!community || !community.is_private) return true;
  if (verifyAdminAccess(user)) return true;
  return isCommunityMember(community, user);
}

/** Filters a timeline down to the posts the user may see. */
export function filterVisiblePosts(
  posts: Post[],
  user?: UserProfile | null,
  communities: Community[] = []
): Post[] {
  if (!posts || posts.length === 0) return posts;
  // Fast path: nothing is private, so nothing to filter.
  if (!communities.some((c) => c.is_private)) return posts;
  return posts.filter((post) => canViewPost(post, user, communities));
}
