import { Platform } from "react-native";

export interface PickImageOptions {
  preferCamera?: boolean;
}

export async function pickImageFromDevice(options: PickImageOptions = {}): Promise<string | null> {
  if (Platform.OS !== "web") {
    const ImagePicker = await import("expo-image-picker");

    if (options.preferCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.back,
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.92
      });

      if (result.canceled) {
        return null;
      }

      return result.assets[0]?.uri ?? null;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.92
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0]?.uri ?? null;
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
