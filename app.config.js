const staticConfig = require('./app.json');

const isSideloadBuild = process.env.FORGE_IOS_SIDELOAD === '1';

/**
 * iLoader re-signs the generated archive with a free Apple ID. Personal-team
 * provisioning cannot reliably carry Forge's App Group/widget extension, so
 * its unsigned archive omits that optional native surface. The JS rest timer
 * already detects the absent native module and keeps its ordinary fallback.
 */
module.exports = () => {
  const config = staticConfig.expo;
  if (!isSideloadBuild) return config;

  // The extension metadata lives in `extra` so that EAS can generate the
  // target. Removing the plugin alone would leave it enabled for prebuild.
  const extra = {
    ...config.extra,
    eas: {
      ...config.extra.eas,
      build: {
        ...config.extra.eas.build,
        experimental: {
          ...config.extra.eas.build.experimental,
          ios: { ...config.extra.eas.build.experimental.ios },
        },
      },
    },
  };
  delete extra.eas.build.experimental.ios.appExtensions;

  return {
    ...config,
    extra,
    plugins: config.plugins.filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-widgets';
    }),
  };
};
