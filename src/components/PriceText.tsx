import { StyleSheet, Text, TextStyle } from "react-native";
import { colors } from "@/theme/tokens";

type Props = {
  value: number;
  style?: TextStyle;
  decimalStyle?: TextStyle;
  prefix?: string;
};

export function PriceText({ value, style, decimalStyle, prefix = "$" }: Props) {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const [whole, fraction = "00"] = formatted.split(".");

  return (
    <Text style={style}>
      {prefix}
      {whole}
      <Text style={[styles.decimal, decimalStyle]}>.{fraction}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  decimal: {
    color: "#B8B8B8"
  }
});
