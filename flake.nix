{
  description = "Forge, a React Native app";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      # What the workstation lacks for this project; direnv loads it through .envrc, and `nix develop` by hand.
      devShells.${system}.default = pkgs.mkShellNoCC {
        # Node for Expo, the web build and the checks; Android and iOS builds run in GitHub Actions.
        packages = [ pkgs.nodejs_24 ];
      };
    };
}
