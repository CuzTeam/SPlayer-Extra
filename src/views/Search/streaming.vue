<template>
  <div class="search-type">
    <Transition name="fade" mode="out-in">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-wrap">
        <n-spin size="large" />
      </div>
      <!-- 搜索结果 -->
      <template v-else-if="hasResults">
        <!-- 多种结果：显示 sub-tab -->
        <template v-if="resultTypeCount > 1">
          <n-tabs v-model:value="subTab" class="sub-tabs" type="segment" size="small">
            <n-tab v-if="result.songs.length > 0" name="songs">
              单曲 ({{ result.songs.length }})
            </n-tab>
            <n-tab v-if="result.artists.length > 0" name="artists">
              歌手 ({{ result.artists.length }})
            </n-tab>
            <n-tab v-if="result.albums.length > 0" name="albums">
              专辑 ({{ result.albums.length }})
            </n-tab>
          </n-tabs>
          <div class="tab-content">
            <SongList
              v-if="subTab === 'songs'"
              :data="result.songs"
              doubleClickAction="add"
              disabledSort
            />
            <div v-else-if="subTab === 'artists'" class="card-grid">
              <div v-for="artist in result.artists" :key="artist.id" class="artist-card">
                <s-image :src="artist.cover" :size="80" round />
                <n-text class="name" depth="2">{{ artist.name }}</n-text>
                <n-text v-if="artist.albumCount" class="sub" depth="3">
                  {{ artist.albumCount }} 张专辑
                </n-text>
              </div>
            </div>
            <div v-else-if="subTab === 'albums'" class="card-grid">
              <div v-for="album in result.albums" :key="album.id" class="album-card">
                <s-image :src="album.cover" :size="120" class="cover" />
                <n-text class="name" depth="2">{{ album.name }}</n-text>
                <n-text v-if="album.artist" class="sub" depth="3">{{ album.artist }}</n-text>
              </div>
            </div>
          </div>
        </template>
        <!-- 单种结果：直接渲染 -->
        <template v-else>
          <SongList
            v-if="result.songs.length > 0"
            :data="result.songs"
            doubleClickAction="add"
            disabledSort
          />
          <div v-else-if="result.artists.length > 0" class="card-grid">
            <div v-for="artist in result.artists" :key="artist.id" class="artist-card">
              <s-image :src="artist.cover" :size="80" round />
              <n-text class="name" depth="2">{{ artist.name }}</n-text>
              <n-text v-if="artist.albumCount" class="sub" depth="3">
                {{ artist.albumCount }} 张专辑
              </n-text>
            </div>
          </div>
          <div v-else-if="result.albums.length > 0" class="card-grid">
            <div v-for="album in result.albums" :key="album.id" class="album-card">
              <s-image :src="album.cover" :size="120" class="cover" />
              <n-text class="name" depth="2">{{ album.name }}</n-text>
              <n-text v-if="album.artist" class="sub" depth="3">{{ album.artist }}</n-text>
            </div>
          </div>
        </template>
      </template>
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

// 子标签
const subTab = ref("songs");

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

// 有结果的数量
const resultTypeCount = computed(
  () =>
    (result.value.songs.length > 0 ? 1 : 0) +
    (result.value.artists.length > 0 ? 1 : 0) +
    (result.value.albums.length > 0 ? 1 : 0),
);

// 选择首个有结果的标签
const pickFirstAvailable = () => {
  if (result.value.songs.length > 0) subTab.value = "songs";
  else if (result.value.artists.length > 0) subTab.value = "artists";
  else if (result.value.albums.length > 0) subTab.value = "albums";
};

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
    pickFirstAvailable();
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
  .sub-tabs {
    flex-shrink: 0;
    margin-bottom: 12px;
  }
  .tab-content {
    flex: 1;
    overflow: hidden;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
    overflow-y: auto;
    height: 100%;
    padding-bottom: 24px;
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
    .name {
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
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
    .cover {
      flex-shrink: 0;
      border-radius: 8px;
      overflow: hidden;
    }
    .name {
      font-size: 14px;
      font-weight: 500;
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
}
</style>
