<template>
  <div class="search-type">
    <Transition name="fade" mode="out-in">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-wrap">
        <n-spin size="large" />
      </div>
      <!-- 搜索结果 -->
      <div v-else-if="hasResults" class="streaming-results">
        <!-- 单曲 -->
        <div v-if="result.songs.length > 0" class="section">
          <n-text class="section-title">单曲 ({{ result.songs.length }})</n-text>
          <SongList :data="result.songs" doubleClickAction="add" disabledSort />
        </div>
        <!-- 歌手 -->
        <div v-if="result.artists.length > 0" class="section">
          <n-text class="section-title">歌手 ({{ result.artists.length }})</n-text>
          <div class="card-grid">
            <div v-for="artist in result.artists" :key="artist.id" class="artist-card">
              <s-image :src="artist.cover" :size="80" round class="artist-cover" />
              <n-text class="artist-name" depth="2">{{ artist.name }}</n-text>
              <n-text v-if="artist.albumCount" class="artist-sub" depth="3">
                {{ artist.albumCount }} 张专辑
              </n-text>
            </div>
          </div>
        </div>
        <!-- 专辑 -->
        <div v-if="result.albums.length > 0" class="section">
          <n-text class="section-title">专辑 ({{ result.albums.length }})</n-text>
          <div class="card-grid">
            <div v-for="album in result.albums" :key="album.id" class="album-card">
              <s-image :src="album.cover" :size="120" class="album-cover" />
              <n-text class="album-name" depth="2">{{ album.name }}</n-text>
              <n-text v-if="album.artist" class="album-artist" depth="3">
                {{ album.artist }}
              </n-text>
            </div>
          </div>
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
  overflow-y: auto;
  .loading-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
  }
  .streaming-results {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-bottom: 24px;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    .section-title {
      font-size: 18px;
      font-weight: bold;
    }
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
  }
  .artist-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    transition: background-color 0.2s;
    cursor: default;
    &:hover {
      background-color: var(--n-color-hover);
    }
    .artist-cover {
      flex-shrink: 0;
    }
    .artist-name {
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .artist-sub {
      font-size: 12px;
    }
  }
  .album-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    transition: background-color 0.2s;
    cursor: default;
    &:hover {
      background-color: var(--n-color-hover);
    }
    .album-cover {
      flex-shrink: 0;
      border-radius: 8px;
      overflow: hidden;
    }
    .album-name {
      font-size: 14px;
      font-weight: 500;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .album-artist {
      font-size: 12px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
