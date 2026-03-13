import { QuestionOption } from "./QuestionOption";

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function MultiSelectOption(props: Props) {
  return <QuestionOption {...props} />;
}

