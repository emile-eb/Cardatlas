import { ReactNode } from "react";
import { ViewStyle } from "react-native";
import { AppButton } from "./AppButton";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  leftIcon?: ReactNode;
};

export function PrimaryButton(props: Props) {
  return <AppButton {...props} variant="primary" />;
}
