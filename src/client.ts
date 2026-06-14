import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { createReadStream } from "fs";
import { Readable } from "stream";

export class YouTubeLiveClient {
  private youtube: youtube_v3.Youtube;

  constructor(auth: OAuth2Client) {
    this.youtube = google.youtube({ version: "v3", auth });
  }

  // ── Broadcasts ─────────────────────────────────────────────────────────────

  async createBroadcast(params: {
    title: string; description?: string; scheduledStartTime?: string;
    privacyStatus?: string; enableAutoStart?: boolean; enableAutoStop?: boolean;
    enableDvr?: boolean; enableEmbed?: boolean;
  }): Promise<youtube_v3.Schema$LiveBroadcast> {
    const res = await this.youtube.liveBroadcasts.insert({
      part: ["snippet", "contentDetails", "status"],
      requestBody: {
        snippet: { title: params.title, description: params.description || "", scheduledStartTime: params.scheduledStartTime || new Date().toISOString() },
        contentDetails: { enableAutoStart: params.enableAutoStart ?? false, enableAutoStop: params.enableAutoStop ?? true, enableDvr: params.enableDvr ?? true, enableEmbed: params.enableEmbed ?? true },
        status: { privacyStatus: params.privacyStatus || "unlisted", selfDeclaredMadeForKids: false },
      },
    });
    return res.data;
  }

  async listBroadcasts(params?: { broadcastStatus?: string; maxResults?: number; pageToken?: string }): Promise<youtube_v3.Schema$LiveBroadcastListResponse> {
    const res = await this.youtube.liveBroadcasts.list({ part: ["snippet", "contentDetails", "status"], broadcastStatus: params?.broadcastStatus || "all", maxResults: params?.maxResults || 10, pageToken: params?.pageToken });
    return res.data;
  }

  async getBroadcast(broadcastId: string): Promise<youtube_v3.Schema$LiveBroadcast> {
    const res = await this.youtube.liveBroadcasts.list({ part: ["snippet", "contentDetails", "status"], id: [broadcastId] });
    const item = res.data.items?.[0];
    if (!item) throw new Error(`Broadcast not found: ${broadcastId}`);
    return item;
  }

  async updateBroadcast(params: { broadcastId: string; title?: string; description?: string; scheduledStartTime?: string; privacyStatus?: string }): Promise<youtube_v3.Schema$LiveBroadcast> {
    const current = await this.getBroadcast(params.broadcastId);
    const res = await this.youtube.liveBroadcasts.update({
      part: ["snippet", "contentDetails", "status"],
      requestBody: {
        id: params.broadcastId,
        snippet: { title: params.title || current.snippet?.title, description: params.description ?? current.snippet?.description, scheduledStartTime: params.scheduledStartTime || current.snippet?.scheduledStartTime },
        status: { privacyStatus: params.privacyStatus || current.status?.privacyStatus },
      },
    });
    return res.data;
  }

  async deleteBroadcast(broadcastId: string): Promise<void> { await this.youtube.liveBroadcasts.delete({ id: broadcastId }); }

  async bindStream(broadcastId: string, streamId: string): Promise<youtube_v3.Schema$LiveBroadcast> {
    const res = await this.youtube.liveBroadcasts.bind({ id: broadcastId, part: ["snippet", "contentDetails", "status"], streamId });
    return res.data;
  }

  async transitionBroadcast(broadcastId: string, status: string): Promise<youtube_v3.Schema$LiveBroadcast> {
    const res = await this.youtube.liveBroadcasts.transition({ id: broadcastId, broadcastStatus: status, part: ["snippet", "status"] });
    return res.data;
  }

  async insertCuepoint(broadcastId: string, durationSecs?: number): Promise<youtube_v3.Schema$Cuepoint> {
    const res = await this.youtube.liveBroadcasts.insertCuepoint({ id: broadcastId, requestBody: { cueType: "cueTypeAd", durationSecs: durationSecs || 30 } });
    return res.data;
  }

  // ── Streams ─────────────────────────────────────────────────────────────────

  async createStream(params: { title: string; resolution?: string; frameRate?: string; ingestionType?: string }): Promise<youtube_v3.Schema$LiveStream> {
    const res = await this.youtube.liveStreams.insert({
      part: ["snippet", "cdn", "contentDetails", "status"],
      requestBody: { snippet: { title: params.title }, cdn: { frameRate: params.frameRate || "60fps", resolution: params.resolution || "1080p", ingestionType: params.ingestionType || "rtmp" } },
    });
    return res.data;
  }

  async listStreams(params?: { maxResults?: number; pageToken?: string }): Promise<youtube_v3.Schema$LiveStreamListResponse> {
    const res = await this.youtube.liveStreams.list({ part: ["snippet", "cdn", "contentDetails", "status"], mine: true, maxResults: params?.maxResults || 10, pageToken: params?.pageToken });
    return res.data;
  }

  async getStream(streamId: string): Promise<youtube_v3.Schema$LiveStream> {
    const res = await this.youtube.liveStreams.list({ part: ["snippet", "cdn", "contentDetails", "status"], id: [streamId] });
    const item = res.data.items?.[0];
    if (!item) throw new Error(`Stream not found: ${streamId}`);
    return item;
  }

  async deleteStream(streamId: string): Promise<void> { await this.youtube.liveStreams.delete({ id: streamId }); }

  // ── Chat ────────────────────────────────────────────────────────────────────

  async listChatMessages(liveChatId: string, pageToken?: string): Promise<youtube_v3.Schema$LiveChatMessageListResponse> {
    const res = await this.youtube.liveChatMessages.list({ liveChatId, part: ["snippet", "authorDetails"], maxResults: 200, pageToken });
    return res.data;
  }

  async sendChatMessage(liveChatId: string, message: string): Promise<youtube_v3.Schema$LiveChatMessage> {
    const res = await this.youtube.liveChatMessages.insert({ part: ["snippet"], requestBody: { snippet: { liveChatId, type: "textMessageEvent", textMessageDetails: { messageText: message } } } });
    return res.data;
  }

  async deleteChatMessage(messageId: string): Promise<void> { await this.youtube.liveChatMessages.delete({ id: messageId }); }

  async listModerators(liveChatId: string): Promise<youtube_v3.Schema$LiveChatModeratorListResponse> {
    const res = await this.youtube.liveChatModerators.list({ liveChatId, part: ["snippet"], maxResults: 50 });
    return res.data;
  }

  async addModerator(liveChatId: string, channelId: string): Promise<youtube_v3.Schema$LiveChatModerator> {
    const res = await this.youtube.liveChatModerators.insert({ part: ["snippet"], requestBody: { snippet: { liveChatId, moderatorDetails: { channelId } } } });
    return res.data;
  }

  async removeModerator(moderatorId: string): Promise<void> { await this.youtube.liveChatModerators.delete({ id: moderatorId }); }

  // ── Videos ──────────────────────────────────────────────────────────────────

  async listVideos(params: { channelId?: string; maxResults?: number; pageToken?: string }): Promise<youtube_v3.Schema$PlaylistItemListResponse> {
    const chRes = await this.youtube.channels.list({
      part: ["contentDetails"],
      ...(params.channelId ? { id: [params.channelId] } : { mine: true }),
    });
    const uploadsId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId) throw new Error("Could not find uploads playlist");
    const res = await this.youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId: uploadsId,
      maxResults: params.maxResults || 25,
      pageToken: params.pageToken,
    });
    return res.data;
  }

  async getVideo(videoId: string): Promise<youtube_v3.Schema$Video> {
    const res = await this.youtube.videos.list({ part: ["snippet", "contentDetails", "status", "statistics"], id: [videoId] });
    const item = res.data.items?.[0];
    if (!item) throw new Error(`Video not found: ${videoId}`);
    return item;
  }

  // NOTE: search.list costs 100 quota units per call (vs ~1 for list/get). The
  // default daily quota is 10,000 units, i.e. ~100 searches/day — use sparingly.
  async searchVideos(params: { query: string; maxResults?: number; channelId?: string; order?: string }): Promise<Array<{ videoId: string; title: string; channelTitle: string; channelId: string; publishedAt: string; url: string; description: string }>> {
    const res = await this.youtube.search.list({
      part: ["snippet"],
      q: params.query,
      type: ["video"],
      maxResults: params.maxResults || 10,
      order: params.order || "relevance",
      ...(params.channelId ? { channelId: params.channelId } : {}),
    });
    return (res.data.items || []).map((item) => {
      const videoId = item.id?.videoId || "";
      return {
        videoId,
        title: item.snippet?.title || "",
        channelTitle: item.snippet?.channelTitle || "",
        channelId: item.snippet?.channelId || "",
        publishedAt: item.snippet?.publishedAt || "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: item.snippet?.description || "",
      };
    });
  }

  async updateVideo(params: { videoId: string; title?: string; description?: string; tags?: string[]; categoryId?: string; privacyStatus?: string; madeForKids?: boolean; commentability?: string }): Promise<youtube_v3.Schema$Video> {
    const current = await this.getVideo(params.videoId);
    const res = await this.youtube.videos.update({
      part: ["snippet", "status"],
      requestBody: {
        id: params.videoId,
        snippet: {
          title: params.title ?? current.snippet?.title,
          description: params.description ?? current.snippet?.description,
          tags: params.tags ?? current.snippet?.tags ?? [],
          categoryId: params.categoryId ?? current.snippet?.categoryId,
        },
        status: {
          privacyStatus: params.privacyStatus ?? current.status?.privacyStatus,
          selfDeclaredMadeForKids: params.madeForKids ?? current.status?.selfDeclaredMadeForKids,
        },
      },
    });
    return res.data;
  }

  async deleteVideo(videoId: string): Promise<void> { await this.youtube.videos.delete({ id: videoId }); }

  async setVideoThumbnail(videoId: string, filePath: string): Promise<youtube_v3.Schema$ThumbnailSetResponse> {
    const mimeType = filePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const res = await this.youtube.thumbnails.set({ videoId, media: { mimeType, body: createReadStream(filePath) } });
    return res.data;
  }

  async listCaptions(videoId: string): Promise<youtube_v3.Schema$CaptionListResponse> {
    const res = await this.youtube.captions.list({ part: ["id", "snippet"], videoId });
    return res.data;
  }

  async uploadCaption(params: { videoId: string; language: string; name: string; srtContent: string; isDraft?: boolean }): Promise<youtube_v3.Schema$Caption> {
    const res = await this.youtube.captions.insert({
      part: ["snippet"],
      requestBody: { snippet: { videoId: params.videoId, language: params.language, name: params.name, isDraft: params.isDraft ?? false } },
      media: { mimeType: "text/plain", body: Readable.from([params.srtContent]) },
    });
    return res.data;
  }

  async deleteCaption(captionId: string): Promise<void> { await this.youtube.captions.delete({ id: captionId }); }

  // ── Channel ─────────────────────────────────────────────────────────────────

  async getChannels(channelId?: string): Promise<youtube_v3.Schema$ChannelListResponse> {
    const res = await this.youtube.channels.list({
      part: ["snippet", "contentDetails", "statistics", "brandingSettings", "status"],
      ...(channelId ? { id: [channelId] } : { mine: true }),
    });
    return res.data;
  }

  async updateChannel(params: { channelId: string; description?: string; keywords?: string; country?: string; defaultLanguage?: string }): Promise<youtube_v3.Schema$Channel> {
    const current = await this.getChannels(params.channelId);
    const ch = current.items?.[0];
    if (!ch) throw new Error(`Channel not found: ${params.channelId}`);
    const res = await this.youtube.channels.update({
      part: ["brandingSettings"],
      requestBody: {
        id: params.channelId,
        brandingSettings: {
          channel: {
            description: params.description ?? ch.brandingSettings?.channel?.description,
            keywords: params.keywords ?? ch.brandingSettings?.channel?.keywords,
            country: params.country ?? ch.brandingSettings?.channel?.country,
            defaultLanguage: params.defaultLanguage ?? ch.brandingSettings?.channel?.defaultLanguage,
          },
        },
      },
    });
    return res.data;
  }

  async uploadChannelBanner(channelId: string, filePath: string): Promise<youtube_v3.Schema$ChannelBannerResource> {
    const mimeType = filePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const bannerRes = await (this.youtube.channelBanners.insert as any)({
      media: { mimeType, body: createReadStream(filePath) },
    }) as { data: youtube_v3.Schema$ChannelBannerResource };
    await this.youtube.channels.update({
      part: ["brandingSettings"],
      requestBody: { id: channelId, brandingSettings: { image: { bannerExternalUrl: bannerRes.data.url } } },
    });
    return bannerRes.data;
  }

  // ── Playlists ───────────────────────────────────────────────────────────────

  async listPlaylists(params: { channelId?: string; maxResults?: number; pageToken?: string }): Promise<youtube_v3.Schema$PlaylistListResponse> {
    const res = await this.youtube.playlists.list({
      part: ["snippet", "contentDetails", "status"],
      ...(params.channelId ? { channelId: params.channelId } : { mine: true }),
      maxResults: params.maxResults || 25,
      pageToken: params.pageToken,
    });
    return res.data;
  }

  async createPlaylist(params: { title: string; description?: string; privacyStatus?: string }): Promise<youtube_v3.Schema$Playlist> {
    const res = await this.youtube.playlists.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title: params.title, description: params.description || "" },
        status: { privacyStatus: params.privacyStatus || "public" },
      },
    });
    return res.data;
  }

  async updatePlaylist(params: { playlistId: string; title?: string; description?: string; privacyStatus?: string }): Promise<youtube_v3.Schema$Playlist> {
    const cur = await this.youtube.playlists.list({ part: ["snippet", "status"], id: [params.playlistId] });
    const current = cur.data.items?.[0];
    if (!current) throw new Error(`Playlist not found: ${params.playlistId}`);
    const res = await this.youtube.playlists.update({
      part: ["snippet", "status"],
      requestBody: {
        id: params.playlistId,
        snippet: { title: params.title ?? current.snippet?.title, description: params.description ?? current.snippet?.description },
        status: { privacyStatus: params.privacyStatus ?? current.status?.privacyStatus },
      },
    });
    return res.data;
  }

  async deletePlaylist(playlistId: string): Promise<void> { await this.youtube.playlists.delete({ id: playlistId }); }

  async addToPlaylist(playlistId: string, videoId: string, position?: number): Promise<youtube_v3.Schema$PlaylistItem> {
    const res = await this.youtube.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId },
          ...(position !== undefined ? { position } : {}),
        },
      },
    });
    return res.data;
  }

  async removeFromPlaylist(playlistItemId: string): Promise<void> { await this.youtube.playlistItems.delete({ id: playlistItemId }); }

  // ── Comments ────────────────────────────────────────────────────────────────

  async listComments(params: { videoId: string; maxResults?: number; pageToken?: string; order?: string }): Promise<youtube_v3.Schema$CommentThreadListResponse> {
    const res = await this.youtube.commentThreads.list({
      part: ["snippet", "replies"],
      videoId: params.videoId,
      maxResults: params.maxResults || 20,
      pageToken: params.pageToken,
      order: (params.order as any) || "time",
    });
    return res.data;
  }

  async replyToComment(parentId: string, text: string): Promise<youtube_v3.Schema$Comment> {
    const res = await this.youtube.comments.insert({
      part: ["snippet"],
      requestBody: { snippet: { parentId, textOriginal: text } },
    });
    return res.data;
  }

  async deleteComment(commentId: string): Promise<void> { await this.youtube.comments.delete({ id: commentId }); }

  async setCommentModerationStatus(commentId: string, moderationStatus: string): Promise<void> {
    await this.youtube.comments.setModerationStatus({ id: [commentId], moderationStatus });
  }
}
