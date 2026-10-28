export interface StealthConfig {
  /** Lớp 1: Bật/tắt Defuser triệt tiêu dữ liệu quảng cáo */
  defuserEnabled: boolean;
  /** Lớp 2: Bật/tắt Cosmetic Filter ẩn banner/overlay */
  cosmeticEnabled: boolean;
  /** Lớp 3: Bật/tắt Visual Mask che mắt khi quảng cáo lọt */
  visualMaskEnabled: boolean;
  /** Lớp 4: Bật/tắt Fast-Seek tua 16x dự phòng */
  fastSeekFallback: boolean;
}

export const defaultStealthConfig: StealthConfig = {
  defuserEnabled: true,
  cosmeticEnabled: true,
  visualMaskEnabled: true,
  fastSeekFallback: true,
};

export const STEALTH_CONFIG_KEY = 'adfilter_stealth_config';