{
  description = "Forge, a React Native app";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      # The workstation is x86_64-linux; CI builds Android on Linux and iOS on Apple-silicon macOS.
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      # What the workstation and CI lack for this project; direnv loads it through .envrc, and
      # `nix develop` by hand. Native toolchains (Xcode, CocoaPods, JDK, Android SDK) stay with
      # the host or runner image.
      devShells = forAllSystems (
        pkgs:
        let
          # Node for Expo, the web build, the checks and the native bundling steps.
          packages = [ pkgs.nodejs_24 ];
        in
        {
          # The build workflows need only Node, not the e2e browsers below.
          ci = pkgs.mkShellNoCC { inherit packages; };
          default = pkgs.mkShellNoCC (
            { inherit packages; }
            // nixpkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
              # Playwright's downloaded browsers do not run on NixOS, so the e2e checks use the
              # nixpkgs builds. `@playwright/test` in package.json is pinned to exactly
              # `pkgs.playwright-driver.version`; bump both together when updating nixpkgs.
              PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
              PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
            }
          );
        }
      );
    };
}
