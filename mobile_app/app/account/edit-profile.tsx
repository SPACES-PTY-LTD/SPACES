import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { ActionSheet, type ActionSheetRef } from '@/component/ui/ActionSheet';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/component/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ApiRequestError, driverApi } from '@/src/lib/api';
import { useAuth } from '@/src/providers/auth-provider';

export default function EditProfileScreen() {
  const { session } = useAuth();
  return <EditProfileForm key={session?.token ?? 'signed-out'} />;
}

export function EditProfileForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, updateSessionUser } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const actions = useRef<ActionSheetRef>(null);
  const alive = useRef(true);
  const busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [name, setName] = useState(session?.user.name ?? '');
  const [telephone, setTelephone] = useState(session?.user.telephone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const nextName = name.trim();
    const currentName = session?.user.name ?? '';
    const currentTelephone = session?.user.telephone ?? '';
    const nextTelephone = telephone.trim();

    if (!nextName) {
      return false;
    }

    return Boolean(photo) || nextName !== currentName || nextTelephone !== currentTelephone;
  }, [photo, name, session?.user.name, session?.user.telephone, telephone]);

  async function pickPhoto(camera: boolean) {
    if (busy.current || !alive.current) return;
    busy.current = true;
    setIsPicking(true);
    setErrorMessage(null);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!alive.current) return;
        if (!permission.granted) throw new Error('Allow camera access in Settings to take a profile picture.');
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!alive.current || result.canceled) return;
      const selected = result.assets[0];
      if (!selected) return;
      if (selected.fileSize && selected.fileSize > 5 * 1024 * 1024) throw new Error('Choose a picture smaller than 5 MB.');
      setPhoto(selected);
    } catch (error) {
      if (alive.current) setErrorMessage(error instanceof Error ? error.message : 'Unable to choose a profile picture.');
    } finally {
      busy.current = false;
      if (alive.current) setIsPicking(false);
    }
  }

  async function handleSave() {
    if (!session?.token || !canSave || busy.current) {
      return;
    }

    busy.current = true;
    setIsSaving(true);

    try {
      if (name.trim() !== session.user.name || telephone.trim() !== (session.user.telephone ?? '')) {
        const response = await driverApi.updateProfile(session.token, {
          name: name.trim(), telephone: telephone.trim() || null,
        });
        if (!alive.current) return;
        await updateSessionUser(response);
      }
      if (!alive.current) return;
      if (photo) {
        const response = await driverApi.updateProfilePhoto(session.token, {
          uri: photo.uri,
          name: photo.fileName || `profile.${photo.mimeType?.split('/')[1] || 'jpg'}`,
          type: photo.mimeType || 'image/jpeg',
        });
        if (!alive.current) return;
        await updateSessionUser(response);
        setPhoto(null);
      }
      if (!alive.current) return;
      setErrorMessage(null);
      router.back();
    } catch (error) {
      const requestError = error as ApiRequestError;
      if (alive.current) setErrorMessage(requestError.message || 'Unable to update profile.');
    } finally {
      busy.current = false;
      if (alive.current) setIsSaving(false);
    }
  }

  const preview = photo?.uri || session?.user.profile_photo_url;
  const disabled = isSaving || isPicking;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View className="bg-secondary rounded-xl px-6 py-6">
          <Text className="text-primary text-sm uppercase tracking-[3px]">Account</Text>
          <Text className="text-secondary-foreground mt-4 text-4xl font-semibold leading-tight">Edit profile</Text>
          <Text className="text-secondary-foreground mt-3 text-base leading-6 opacity-80">
            Update your driver profile details used by dispatch and support teams.
          </Text>
        </View>

        <View className="bg-card mt-6 rounded-xl px-5 py-5">
          <View className="mb-6 flex-row items-center gap-4">
            {preview && failedPhoto !== preview ? <Image source={{ uri: preview }} style={{ width: 80, height: 80, borderRadius: 40 }} contentFit="cover" accessibilityLabel="Driver profile picture" onError={() => setFailedPhoto(preview)} /> : <View className="bg-muted items-center justify-center" style={{ width: 80, height: 80, borderRadius: 40 }}><Feather name="user" size={32} color={isDarkMode ? '#a1a1aa' : '#71717a'} /></View>}
            <View className="flex-1">
              <Text className="text-card-foreground text-lg font-semibold">Driver picture</Text>
              <Pressable accessibilityRole="button" disabled={disabled} onPress={() => actions.current?.present({ title: 'Update driver picture', actions: [
                { id: 'library', label: 'Choose from photos', onPress: () => pickPhoto(false) },
                { id: 'camera', label: 'Take a photo', onPress: () => pickPhoto(true) },
              ] })} className="mt-2 flex-row items-center gap-2 py-2">
                {isPicking ? <ActivityIndicator color="#15803d" /> : <Feather name="camera" size={18} color="#15803d" />}
                <Text className="text-primary font-semibold">{preview ? 'Change picture' : 'Add picture'}</Text>
              </Pressable>
              <Text className="text-muted-foreground text-xs">Up to 5 MB · Saved when you tap Save</Text>
              {photo ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setPhoto(null)} className="mt-1 py-2"><Text className="text-muted-foreground text-sm">Undo picture change</Text></Pressable> : null}
            </View>
          </View>
          <Text className="text-muted-foreground text-sm uppercase tracking-[2px]">Name</Text>
          <TextInput
            editable={!disabled}
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
            className="border-input-border bg-input text-input-foreground mt-2 rounded-[6px] border px-4 py-3 text-base"
          />

          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Telephone</Text>
          <TextInput
            editable={!disabled}
            value={telephone}
            onChangeText={setTelephone}
            placeholder="Telephone number"
            placeholderTextColor={isDarkMode ? '#71717A' : '#A8A29E'}
            keyboardType="phone-pad"
            className="border-input-border bg-input text-input-foreground mt-2 rounded-[6px] border px-4 py-3 text-base"
          />

          <Text className="text-muted-foreground mt-5 text-sm uppercase tracking-[2px]">Email</Text>
          <Text className="text-card-foreground mt-1 text-lg font-semibold">{session?.user.email ?? '-'}</Text>
        </View>

        {errorMessage ? (
          <View className="border-warning bg-warning mt-6 rounded-xl border px-5 py-5">
            <Text className="text-warning-foreground text-base font-semibold">{errorMessage}</Text>
          </View>
        ) : null}

        <View className="mt-6 flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="bg-muted flex-1 items-center rounded-full px-6 py-4"
            disabled={disabled}>
            <Text className="text-foreground text-base font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={disabled || !canSave}
            className={`flex-1 items-center rounded-full px-6 py-4 ${
              disabled || !canSave ? 'bg-primary opacity-50' : 'bg-primary'
            }`}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-primary-foreground text-base font-semibold">Save</Text>}
          </Pressable>
        </View>
      </ScrollView>
      <ActionSheet ref={actions} />
    </View>
  );
}
