import type { ImageType } from "../../media/image_types";

export interface UpdateProfileDTO {
  name?: string;
  lastname?: string;
  username?: string;
  phone?: string | null;
  country_code?: string | null;
  avatar_type?: ImageType;
  avatar_data?: Buffer;
}
