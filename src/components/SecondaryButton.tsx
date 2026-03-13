import { ViewStyle } from "react-native";
import { AppButton } from "./AppButton";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function SecondaryButton(props: Props) {
  return <AppButton {...props} variant="secondary" />;
}
