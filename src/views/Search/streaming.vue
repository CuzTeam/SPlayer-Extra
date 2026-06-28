<template>
  <div class="search-type">
    <Transition name="fade" mode="out-in">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-wrap">
        <n-spin size="large" />
      </div>
      <!-- 搜索结果 -->
      <div v-else-if="hasResults" class="streaming-results">
        <!-- 歌手横滑行 -->
        <div v-if="result.artists.length > 0" class="h-section">
          <n-text class="h-title">歌手 ({{ result.artists.length }})</n-text>
          <n-scrollbar x-scrollable class="h-scroll">
            <div class="h-row">
              <div v-for="artist in result.artists" :key="artist.id" class="artist-card">
                <s-image :src="artist.cover" :size="56" round />
                <n-text class="name" depth="2">{{ artist.name }}</n-text>
              </div>
            </div>
          </n-scrollbar>
        </div>
        <!-- 专辑横滑行 -->
        <div v-if="result.albums.length > 0" class="h-section">
          <n-text class="h-title">专辑 ({{ result.albums.length }})</n-text>
          <n-scrollbar x-scrollable class="h-scroll">
            <div class="h-row">
              <div v-for="album in result.albums" :key="album.id" class="album-card">
                <s-image :src="album.cover" :size="80" class="cover" />
                <n-text class="name" depth="2">{{ album.name }}</n-text>
                <n-text v-if="album.artist" class="sub" depth="3">{{ album.artist }}</n-text>
              </div>
            </div>
          </n-scrollbar>
        </div>
        <!-- 单曲列表 -->
        <div v-if="result.songs.length > 0" class="song-section">
          <n-text class="h-title">单曲 ({{ result.songs.length }})</n-text>
          <SongList :data="result.songs" doubleClickAction="add" disabledSort />
        </div>
      </div>
      <!-- 无结果 -->
      <n-empty
        v-else
        :description="error || `很抱歉，未能找到与 ${keyword} 相关的任何内容`"
        style="margin-top: 60px"
        size="large"
      >
        <template #icon>
          <SvgIcon name="SearchOff" />
        </template>
      </n-empty>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type {
  StreamingServerConfig,
  StreamingArtistType,
  StreamingAlbumType,
} from "@/types/streaming";
import type { SongType } from "@/types/main";
import { subsonic, jellyfin, emby } from "@/api/streaming";
import { useStreamingStore } from "@/stores";

interface StreamingSearchResult {
  artists: StreamingArtistType[];
  albums: StreamingAlbumType[];
  songs: SongType[];
}

const props = defineProps<{
  keyword: string;
}>();

const route = useRoute();
const streamingStore = useStreamingStore();

// 搜索结果
const loading = ref(true);
const error = ref("");
const result = ref<StreamingSearchResult>({
  artists: [],
  albums: [],
  songs: [],
});

// 是否有结果
const hasResults = computed(
  () =>
    result.value.songs.length > 0 ||
    result.value.artists.length > 0 ||
    result.value.albums.length > 0,
);

// 获取服务器配置
const getServer = (): StreamingServerConfig | null => {
  const serverId = route.params.serverId as string;
  return streamingStore.servers.value.find((s) => s.id === serverId) || null;
};

// 执行搜索
const doSearch = async () => {
  loading.value = true;
  error.value = "";
  result.value = { artists: [], albums: [], songs: [] };

  const server = getServer();
  if (!server) {
    error.value = "未找到该流媒体服务器";
    loading.value = false;
    return;
  }

  try {
    let res: StreamingSearchResult;
    if (server.type === "jellyfin") {
      res = await jellyfin.search(server, props.keyword);
    } else if (server.type === "emby") {
      res = await emby.search(server, props.keyword);
    } else {
      res = await subsonic.search(server, props.keyword);
    }
    result.value = res;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "搜索失败，请检查服务器连接";
  } finally {
    loading.value = false;
  }
};

// 关键词或服务器变化时重新搜索
watch([() => props.keyword, () => route.params.serverId], () => doSearch(), { immediate: true });
</script>

<style lang="scss" scoped>
.search-type {
  height: 100%;
  display: flex;
  flex-direction: column;
  .loading-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
  }
  .streaming-results {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .h-section {
    flex-shrink: 0;
    padding: 0 0 12px;
  }
  .h-title {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 8px;
    display: block;
  }
  .h-scroll {
    :deep(.n-scrollbar-content) {
      padding: 4px 0;
    }
  }
  .h-row {
    display: flex;
    gap: 16px;
  }
  .artist-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 72px;
    flex-shrink: 0;
    .name {
      font-size: 13px;
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .album-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 96px;
    flex-shrink: 0;
    .cover {
      border-radius: 8px;
      overflow: hidden;
    }
    .name {
      font-size: 13px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      font-size: 12px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .song-section {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}
</style>
