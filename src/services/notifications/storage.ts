import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_STORAGE_KEY = "cardatlas:notifications:device-id:v1";

function createLocalDeviceId() {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `cardatlas-${seed}`;
}

export async function getOrCreateNotificationDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing?.trim()) {
    return existing;
  }

  const next = createLocalDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}
