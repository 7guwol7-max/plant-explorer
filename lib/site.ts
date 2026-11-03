/**
 * 앱 이름표·메뉴·장소 — 값은 저장소 맨 위 app-settings.json 에서 고친다 (lib/settings.ts 가 읽음)
 */
import { SETTINGS } from "./settings";

export const SITE = {
  ...SETTINGS.app, // name, shortName, tagline, emoji
  menu: SETTINGS.menu,
  places: SETTINGS.places,
  notice: SETTINGS.notice,
};
