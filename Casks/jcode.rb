cask "jcode" do
  arch arm: "arm64", intel: "x64"

  version "0.0.48"
  sha256 :no_check

  url "https://github.com/Jay1/jcode/releases/download/v#{version}/JCode-#{version}-#{arch}.dmg",
      verified: "github.com/Jay1/jcode/"
  name "JCode"
  desc "Local cockpit for coding agents"
  homepage "https://github.com/Jay1/jcode"

  app "JCode.app"

  zap trash: [
    "~/Library/Application Support/JCode",
    "~/Library/Caches/com.jcode",
    "~/Library/Logs/JCode",
    "~/Library/Preferences/com.jcode.plist",
  ]
end
