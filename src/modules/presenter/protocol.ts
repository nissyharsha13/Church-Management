import type { SlideVerse } from "@/lib/bible/slides";
import type { MediaKind, MediaSource } from "@/modules/media/types";

/**
 * Presenter protocol — the single command language between controllers
 * (pastor console today; media-person console and AI listener later) and
 * the display screen(s). See docs/ARCHITECTURE.md#presenter.
 */

export type LanguageMode = "both" | "primary" | "secondary";

export type Scene =
  | { kind: "blank" }
  | { kind: "logo" }
  /** Before the sermon: greeting, clock, welcome verse, "starting shortly" */
  | { kind: "welcome" }
  /** After the sermon: thank-you, clock, a verse for the week */
  | { kind: "ended" }
  | { kind: "title"; title: string; subtitle: string }
  | { kind: "camera" }
  | {
      kind: "verse";
      cueId: string;
      refPrimary: string;
      refSecondary: string;
      primaryAbbr: string;
      secondaryAbbr: string;
      slideIndex: number;
      slideCount: number;
      verses: SlideVerse[];
    }
  | {
      kind: "media";
      cueId: string;
      /** changes on every (re)start so the display reloads the player */
      nonce: string;
      mediaId: string;
      title: string;
      mediaKind: MediaKind;
      source: MediaSource;
      fileId?: string;
      youtubeId?: string;
      startSec?: number;
      endSec?: number;
    };

export interface DisplayState {
  scene: Scene;
  languageMode: LanguageMode;
  /** When the camera is on, it is the background whenever nothing else is shown. */
  cameraOn: boolean;
  cameraDeviceId: string | null;
  /** Show verses as a lower-third over the camera instead of full screen */
  overlayOnCamera: boolean;
  fontScale: number;
  church: ChurchInfo;
  /** Bible translations used for welcome/ended verses */
  translations: { primary: string; secondary: string };
}

/** Church details shown on the screen (logo itself is read from settings by the screen). */
export interface ChurchInfo {
  name: string;
  nameTe: string;
  tagline: string;
  pastorName: string;
  address: string;
  serviceTimes: string;
  youtubeName: string;
  youtubeUrl: string;
}

export const EMPTY_CHURCH: ChurchInfo = { name: "", nameTe: "", tagline: "", pastorName: "", address: "", serviceTimes: "", youtubeName: "", youtubeUrl: "" };

export interface MediaStatus {
  nonce: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
}

export type ControllerMessage =
  | { type: "state"; state: DisplayState; sentAt: number }
  | { type: "media"; action: "play" | "pause" | "restart"; nonce: string };

export type DisplayMessage =
  | { type: "hello" }
  | { type: "ping"; screenId: string; fullscreen: boolean }
  | { type: "media-status"; status: MediaStatus };

export type PresenterMessage = ControllerMessage | DisplayMessage;

export const INITIAL_STATE: DisplayState = {
  scene: { kind: "logo" },
  languageMode: "both",
  cameraOn: false,
  cameraDeviceId: null,
  overlayOnCamera: true,
  fontScale: 1,
  church: EMPTY_CHURCH,
  translations: { primary: "te-irv", secondary: "en-kjv" },
};

/** What to show when the operator presses "Clear". */
export function backgroundScene(state: DisplayState): Scene {
  return state.cameraOn ? { kind: "camera" } : { kind: "logo" };
}
