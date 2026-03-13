import { Platform } from "react-native";

export interface PickImageOptions {
  preferCamera?: boolean;
}

export async function pickImageFromDevice(options: PickImageOptions = {}): Promise<string | null> {
  if (Platform.OS !== "web") {
    // Native picker integration can be swapped to expo-image-picker later.
    return null;
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (options.preferCamera) {
      input.setAttribute("capture", "environment");
    }

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      resolve(objectUrl);
    };

    input.click();
  });
}
