const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

// react-native-maps 1.27.2 pins Maps 9; Navigation 0.16.3 pins Maps 10.13.
// Align their pod requirements before CocoaPods resolves either library. Both
// renderers then link the same framework, retaining RN Maps markers/camera APIs.
function alignGoogleMapsPodspec(source) {
  for (const [name, original, replacement] of [
    ['GoogleMaps', '9.4.0', '10.13.0'],
    ['Google-Maps-iOS-Utils', '6.1.0', '7.0.0'],
  ]) {
    const oldLine = `ss.dependency '${name}', '${original}'`;
    const newLine = `ss.dependency '${name}', '${replacement}'`;
    if (!source.includes(oldLine) && !source.includes(newLine)) {
      throw new Error(`Unexpected react-native-maps ${name} requirement. Review iOS Maps/Navigation compatibility before building.`);
    }
    source = source.replace(oldLine, newLine);
  }
  return source;
}

module.exports = function withGoogleMapsIOS(config) {
  return withDangerousMod(config, ['ios', async mod => {
    const packagePath = require.resolve('react-native-maps/package.json', { paths: [mod.modRequest.projectRoot] });
    const mapsPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (mapsPackage.version !== '1.27.2') {
      throw new Error('Review the iOS Google Maps compatibility plugin when upgrading react-native-maps.');
    }
    const podspecPath = path.join(path.dirname(packagePath), 'react-native-maps.podspec');
    const original = fs.readFileSync(podspecPath, 'utf8');
    const aligned = alignGoogleMapsPodspec(original);
    if (aligned !== original) fs.writeFileSync(podspecPath, aligned);
    return mod;
  }]);
};
module.exports.alignGoogleMapsPodspec = alignGoogleMapsPodspec;
