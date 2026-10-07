# Welcome to your Expo app 👋

## Dashboard design and implementation plan

Read the [driver dashboard plan](../docs/design/dashboard/README.md) before updating the dashboard or delivery-note upload flow. Keep that plan updated whenever the intended behaviour changes.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app
   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Spaces Digital development builds

This app uses a custom Expo development client for native Google Maps and the date picker. Run commands from `mobile_app`.

- EAS project: [@leroyg/spaces-digital](https://expo.dev/accounts/leroyg/projects/spaces-digital).
- iOS bundle identifier / Android package: `com.spaces.logistics`.
- `development-simulator`: iOS simulator client, without Apple signing credentials.
- `development`: internal development client for physical devices; Android produces an APK. Physical iOS devices require Apple signing/provisioning.
- `preview` and `production`: separate non-development build profiles.

Configure these variables in the EAS **development** environment before submitting:

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `GOOGLE_MAPS_IOS_API_KEY` | Sensitive | Maps SDK for iOS |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Sensitive | Maps SDK for Android |
| `EXPO_PUBLIC_API_BASE_URL` | Plaintext | Reachable Laravel URL including `/api/v1` |
| `EXPO_PUBLIC_APP_ENV` | Plaintext | `development` |

`app.config.js` passes keys through the current `react-native-maps` plugin options (`iosGoogleMapsApiKey` / `androidGoogleMapsApiKey`). Missing platform keys fail EAS builds with an actionable error. Keep actual keys out of app.json and Git. Sensitive variables are needed during both local EAS config resolution and the remote build. Root `.easignore` includes only the mobile app and excludes environment files, native generated directories and dependencies.

```sh
npm run build:dev:ios
# After completion, download/install the simulator build:
eas build:run --platform ios --latest
npm start
```

For Android: `npm run build:dev:android`. For a signed physical iOS client: `eas build --platform ios --profile development`.

`npm start` targets the development client; `npm run start:go` explicitly targets Expo Go. Native dependency or plugin changes require rebuilding. A local LAN API URL only works while the device is on a network that can reach that server. Native key restrictions must match `com.spaces.logistics` (and Android signing SHA-1). `[RunMap]` development logs report initialization and request failures without logging keys or GPS coordinates.

Setup status (2026-10-07): dev client and EAS profiles/project are configured. With explicit user approval, both Maps keys were added as Sensitive variables and the API URL/app environment as Plaintext variables in the EAS development environment. The previous Android build failed because that environment had no variables. [Android development build retry](https://expo.dev/accounts/leroyg/projects/spaces-digital/builds/1fb1ff0a-dd1d-4929-98d8-1f1d3ae3c433) was submitted using the existing remote signing credentials; native map verification remains pending until it completes and is installed.


## Messages and assigned vehicles

Messages replaces Vehicles in the bottom navigation and opens the driver's shared dispatch conversation. Account → **Vehicles assigned to me** opens the existing assigned fleet and vehicle details. Text and up to five private attachments (20 MB each) are supported. Normal conversations are website/API-only initially. Visible chats poll every ten seconds; drafts survive send failures.

Native push uses `expo-notifications`, existing device registration, the configured EAS project ID, and queued backend delivery. Rebuild development clients. Android needs FCM v1 credentials and an EAS File variable `GOOGLE_SERVICES_JSON` for `android.googleServicesFile`; iOS needs APNs credentials and a signed device build. These external credentials/builds remain pending. Permission denial leaves messaging available. Notification taps authorize and open the driver's chat; active-chat banners are suppressed.

See [messaging API, permissions and rollout](../docs/messaging.md) for migrations, workers, private storage and verification.

Messages shows the received unread count on its tab (99+ above 99). The count refreshes every ten seconds while foregrounded, on navigation/foreground and after successful read acknowledgement; it clears when read and resets on session changes.

Final-destination search uses `POST /api/v1/driver/trip-locations/search` with `{ query, page }`. The array response includes `meta.next_page`; saved locations are paginated in stable ID order, 20 per page. The picker appends/deduplicates pages near the scroll end, shows Loading more… and retains existing results with a retry action on pagination failure. Geocoding fallback returns a terminal first page.
