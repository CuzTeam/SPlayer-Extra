<template>
  <div class="search">
    <div class="title">
      <n-text class="keyword">{{ searchKeyword }}</n-text>
      <n-text depth="3">的相关搜索</n-text>
    </div>
    <!-- 标签页 -->
    <n-tabs v-model:value="searchType" class="tabs" type="segment" @update:value="tabChange">
      <n-tab name="search-songs"> 单曲 </n-tab>
      <n-tab name="search-playlists"> 歌单 </n-tab>
      <n-tab name="search-artists"> 歌手 </n-tab>
      <n-tab name="search-albums"> 专辑 </n-tab>
      <n-tab name="search-videos"> 视频 </n-tab>
      <n-tab name="search-radios"> 播客 </n-tab>
      <n-tab
        v-for="server in searchableServers"
        :key="server.id"
        :name="`search-streaming-${server.id}`"
      >
        {{ server.name }}
      </n-tab>
    </n-tabs>
    <!-- 路由 -->
    <RouterView v-slot="{ Component }">
      <Transition :name="`router-${settingStore.routeAnimation}`" mode="out-in">
        <KeepAlive v-if="settingStore.useKeepAlive">
          <component
            :is="Component"
            :key="route.fullPath"
            :keyword="searchKeyword"
            class="router-view"
          />
        </KeepAlive>
        <component
          v-else
          :is="Component"
          :key="route.fullPath"
          :keyword="searchKeyword"
          class="router-view"
        />
      </Transition>
    </RouterView>
  </div>
</template>

<script setup lang="ts">
import { useSettingStore, useStreamingStore } from "@/stores";
const route = useRoute();
const router = useRouter();
const settingStore = useSettingStore();
const streamingStore = useStreamingStore();

// 搜索关键词
const searchKeyword = computed(() => route.query.keyword as string);

// 搜索分类
const searchType = ref<string>("search-songs");

// 可搜索的流媒体服务器
const searchableServers = computed(() => {
  if (!settingStore.streamingEnabled) return [];
  return streamingStore.servers.value.filter((s) => {
    if (s.type === "jellyfin" || s.type === "emby") {
      return !!s.accessToken && !!s.userId;
    }
    return true;
  });
});

// Tabs 改变
const tabChange = (value: string) => {
  // 流媒体 Tab
  if (value.startsWith("search-streaming-")) {
    const serverId = value.replace("search-streaming-", "");
    router.push({
      name: "search-streaming",
      params: { serverId },
      query: { keyword: searchKeyword.value },
    });
    return;
  }
  router.push({
    name: value,
    query: {
      keyword: searchKeyword.value,
    },
  });
};

// 监听路由变化，同步 Tab 状态
watch(
  () => route.name,
  (name) => {
    if (name === "search-streaming") {
      searchType.value = `search-streaming-${route.params.serverId}`;
    } else if (name && name.toString().startsWith("search-")) {
      searchType.value = name as string;
    }
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.search {
  display: flex;
  flex-direction: column;
  height: 100%;
  .title {
    margin-top: 12px;
    margin-bottom: 12px;
    font-size: 22px;
    .keyword {
      font-size: 36px;
      font-weight: bold;
      margin-right: 8px;
      line-height: normal;
    }
    .n-text {
      display: inline-block;
    }
  }
  .tabs {
    :deep(.n-tabs-nav) {
      overflow-x: auto;
      scrollbar-width: none;
      &::-webkit-scrollbar {
        display: none;
      }
    }
    :deep(.n-tabs-rail) {
      min-width: max-content;
    }
    :deep(.n-tab) {
      flex-shrink: 0;
    }
  }
  .router-view {
    flex: 1;
    overflow: hidden;
  }
}
</style>
