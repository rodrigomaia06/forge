Pod::Spec.new do |s|
  s.name = 'ForgeRestTimerLiveActivity'
  s.version = '1.0.0'
  s.summary = 'Forge local rest timer Live Activity bridge'
  s.description = 'Starts, updates, and ends Forge rest timer Live Activities.'
  s.author = 'Forge'
  s.homepage = 'https://github.com/rodrigomaia06/forge-ReactNative'
  s.license = 'GPL-3.0'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/rodrigomaia06/forge-ReactNative.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
