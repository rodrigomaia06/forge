Pod::Spec.new do |s|
  s.name = 'ForgeRangeKeyboard'
  s.version = '1.0.0'
  s.summary = 'Forge native range-entry keyboard'
  s.description = 'An app-local number keypad with a dedicated range separator.'
  s.author = 'Forge'
  s.homepage = 'https://github.com/rodrigomaia06/forge-ReactNative'
  s.license = 'GPL-3.0-or-later'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/rodrigomaia06/forge-ReactNative.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
