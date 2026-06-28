/**
 * 网易云听歌打卡 Scrobbler
 * 基于 /scrobble/v1 (NCBL 加密版) 上报听歌记录
 * 计时基于 audio.currentTime 差值累加，排除暂停与拖拽
 */

import { scrobbleV1 } from "@/api/user";
import { useSettingStore, useStatusStore, useMusicStore } from "@/stores";
import { isElectron } from "@/utils/env";
import { getPlayerInfoObj } from "@/utils/format";
import { QualityType } from "@/types/main";
import type { SongType } from "@/types/main";

// QualityType → level 字符串 + 典型码率
const qualityToLevel: Record<QualityType, { level: string; bitrate: number }> = {
  [QualityType.Master]: { level: "jymaster", bitrate: 1999 },
  [QualityType.Dolby]: { level: "dolby", bitrate: 999 },
  [QualityType.Spatial]: { level: "sky", bitrate: 999 },
  [QualityType.Surround]: { level: "jyeffect", bitrate: 999 },
  [QualityType.HiRes]: { level: "hires", bitrate: 1999 },
  [QualityType.SQ]: { level: "lossless", bitrate: 999 },
  [QualityType.HQ]: { level: "exhigh", bitrate: 320 },
  [QualityType.MQ]: { level: "higher", bitrate: 192 },
  [QualityType.LQ]: { level: "standard", bitrate: 128 },
};

class NcmScrobbler {
  /** 当前打卡中的歌曲 */
  private currentSong: SongType | null = null;
  /** 累计实际播放秒数 */
  private playedSeconds: number = 0;
  /** 上次 tick 的 audio.currentTime */
  private lastTickTime: number | null = null;
  /** 是否已结算 */
  private hasScrobbled: boolean = false;
  /** seek 后跳过下一次累加 */
  private seekFlag: boolean = false;

  /** 是否为可打卡的网易云歌曲 */
  private isNcmSong(song: SongType | null): boolean {
    if (!song) return false;
    return song.type === "song" && !song.path && !song.serverId;
  }

  /** 是否启用打卡 */
  private isEnabled(): boolean {
    return isElectron && useSettingStore().scrobbleSong;
  }

  /**
   * 开始播放新歌曲
   * 若上一首未结算，先补报
   */
  public startPlaying(song: SongType) {
    // 结算上一首
    if (this.currentSong && !this.hasScrobbled) {
      void this.flush();
    }
    // 重置为新歌
    this.currentSong = song;
    this.playedSeconds = 0;
    this.lastTickTime = null;
    this.hasScrobbled = false;
    this.seekFlag = false;
  }

  /**
   * 累加播放时长
   * @param currentTime audio.currentTime（秒）
   */
  public tick(currentTime: number) {
    if (!this.currentSong || this.hasScrobbled) return;
    // 首次或 seek 后重新基准
    if (this.lastTickTime === null || this.seekFlag) {
      this.lastTickTime = currentTime;
      this.seekFlag = false;
      return;
    }
    const delta = currentTime - this.lastTickTime;
    // 正常播放 delta 在 (0, ~1.5]，异常跳变不累加
    if (delta > 0 && delta <= 2) {
      this.playedSeconds += delta;
    }
    this.lastTickTime = currentTime;
  }

  /** 暂停播放 */
  public pause() {
    this.lastTickTime = null;
  }

  /** 恢复播放 */
  public resume() {
    // 重置基准，由下次 tick 重新初始化
    this.lastTickTime = null;
  }

  /** 拖拽进度 */
  public onSeek() {
    this.seekFlag = true;
  }

  /** 停止播放（自然结束） */
  public stop() {
    void this.flush();
    this.currentSong = null;
    this.playedSeconds = 0;
    this.lastTickTime = null;
    this.hasScrobbled = false;
  }

  /** 执行上报 */
  private async flush() {
    if (!this.currentSong || this.hasScrobbled) return;
    if (!this.isEnabled() || !this.isNcmSong(this.currentSong)) return;
    if (this.playedSeconds <= 0) return;

    // 标记已结算，防止重复
    this.hasScrobbled = true;

    const song = this.currentSong;
    const settingStore = useSettingStore();
    const statusStore = useStatusStore();
    const musicStore = useMusicStore();
    const info = getPlayerInfoObj(song) || { name: song.name, artist: "", album: "" };

    // 精确音质：优先用实际播放音质，fallback 到用户设置
    const qualityInfo = statusStore.songQuality
      ? qualityToLevel[statusStore.songQuality]
      : undefined;
    const level = qualityInfo?.level ?? settingStore.songLevel;
    const bitrate = qualityInfo?.bitrate ?? 320;

    const totalSeconds = song.duration > 0 ? Math.floor(song.duration / 1000) : undefined;

    try {
      await scrobbleV1({
        id: song.id,
        time: Math.floor(this.playedSeconds),
        total: totalSeconds,
        sourceid: musicStore.playPlaylistId || undefined,
        source: "list",
        name: info.name,
        artist: info.artist,
        bitrate,
        level,
      });
      console.log(
        `📊 网易云打卡成功: ${info.name} - ${info.artist} (${Math.floor(this.playedSeconds)}s)`,
      );
    } catch (error) {
      console.error("❌ 网易云打卡失败:", error);
    }
  }
}

// 单例
const ncmScrobbler = new NcmScrobbler();

export default ncmScrobbler;
