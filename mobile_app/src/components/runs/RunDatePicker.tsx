import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function RunDatePicker({
    value,
    onChange,
    onDismiss,
}: {
    value: Date;
    onChange: (date: Date) => void;
    onDismiss: () => void;
}) {
    const { colorScheme } = useColorScheme();
    return (
        <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            themeVariant={colorScheme === "dark" ? "dark" : "light"}
            onValueChange={(_, date) => onChange(date)}
            onDismiss={onDismiss}
        />
    );
}
