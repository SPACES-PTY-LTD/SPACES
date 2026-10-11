const { withInfoPlist, withAppDelegate, withProjectBuildGradle, withAppBuildGradle, withAndroidManifest } = require('@expo/config-plugins');
const { mergeContents, removeContents } = require('@expo/config-plugins/build/utils/generateCode');
module.exports = function withNavigation(config) {
  // react-native-maps now initializes the shared Maps/Navigation API key.
  // Remove the previous Navigation-only setup on incremental prebuilds.
  config = withAppDelegate(config, mod => {
    for (const tag of ['spaces-navigation-import', 'spaces-navigation-key']) {
      mod.modResults.contents = removeContents({ tag, src: mod.modResults.contents }).contents;
    }
    return mod;
  });
  config = withInfoPlist(config, mod => {
    mod.modResults.UIBackgroundModes = [...new Set([...(mod.modResults.UIBackgroundModes || []), 'location', 'audio'])]; return mod;
  });
  config = withAndroidManifest(config, mod => {
    for (const permission of ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_LOCATION', 'android.permission.POST_NOTIFICATIONS']) {
      const entries = mod.modResults.manifest['uses-permission'] ||= [];
      if (!entries.some(item => item.$?.['android:name'] === permission)) entries.push({ $: { 'android:name': permission } });
    } return mod;
  });
  config = withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Navigation requires the Expo Groovy app Gradle file.');
    // Navigation 7.6.1 requires the NIO desugaring library, including on minSdk 24.
    mod.modResults.contents = mergeContents({ tag: 'spaces-navigation-desugaring', src: mod.modResults.contents,
      newSrc: `android {
    compileOptions {
        coreLibraryDesugaringEnabled true
    }
}
dependencies {
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.0.4'
}`,
      anchor: /^android \{/, offset: 0, comment: '//' }).contents;
    return mod;
  });
  return withProjectBuildGradle(config, mod => {
    const legacy = `\n// spaces-navigation-maps: one native Maps implementation\nsubprojects {\n  configurations.configureEach {\n    exclude group: 'com.google.android.gms', module: 'play-services-maps'\n  }\n}\n`;
    // Substitution supplies Navigation's Maps classes to every consumer's compile path.
    mod.modResults.contents = mergeContents({ tag: 'spaces-navigation-maps', src: mod.modResults.contents.replace(legacy, ''),
      newSrc: `subprojects {
  configurations.configureEach {
    resolutionStrategy.dependencySubstitution {
      substitute module('com.google.android.gms:play-services-maps') using module('com.google.android.libraries.navigation:navigation:7.6.1')
    }
  }
}`,
      anchor: /^apply plugin: "com.facebook.react.rootproject"/, offset: 1, comment: '//' }).contents;
    return mod;
  });
};
