"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import GelSlider from "./gel-slider"

interface AvatarSelectorProps {
  onSelect: (avatar: string, data: any) => void
}

interface HeygenAvatar {
  avatar_id: string
  avatar_name: string
  gender: string
  preview_image_url: string
  preview_video_url?: string
  premium?: boolean
}

interface HeygenVoice {
  voice_id: string
  name: string
  language: string
  gender: string
  preview_audio: string
}


const IPL_SEASONS = Array.from({ length: 18 }, (_, i) => 2008 + i)
const MATCH_NUMBERS = Array.from({ length: 70 }, (_, i) => i + 1)
const INNINGS = [1, 2]
const OVERS = Array.from({ length: 20 }, (_, i) => i + 1)

export default function AvatarSelector({ onSelect }: AvatarSelectorProps) {
  const [avatars, setAvatars] = useState<HeygenAvatar[]>([])
  const [voices, setVoices] = useState<HeygenVoice[]>([])
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null)
  const [season, setSeason] = useState<number>(2024)
  const [matchNumber, setMatchNumber] = useState<number>(1)
  const [inning, setInning] = useState<number>(1)
  const [over, setOver] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [hoveredInput, setHoveredInput] = useState<string | null>(null)

  // Fetch avatars
  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const res = await fetch("/api/avatars")
        const data = await res.json()
        if (data?.avatars) setAvatars(data.avatars)
      } catch (err) {
        console.error("Error fetching avatars:", err)
      }
    }
    fetchAvatars()
  }, [])
  const  apikey = process.env.NEXT_PUBLIC_HEYGEN_KEY?? ""

  // Fetch voices
  useEffect(() => {
    const fetchVoices = async () => {
      const cachedVoices = localStorage.getItem("heygen_voices")
      if (cachedVoices) {
        setVoices(JSON.parse(cachedVoices))
        return
      }
      try {
        const res = await fetch("https://api.heygen.com/v2/voices", {
          headers: {
            accept: "application/json",
            "x-api-key": apikey,
          },
        });
  
        const data = await res.json();
        console.log("Voices API Response:", data);
  
        if (data?.data?.voices) {
          // Filter out voices without preview_audio
          const voicesWithPreview = data.data.voices.filter(
            (v: any) => v.preview_audio && v.preview_audio.trim() !== ""
          );
  
          // Take top 5 only
          const uniqueVoicesMap = new Map();
          for (const v of voicesWithPreview) {
            if (!uniqueVoicesMap.has(v.name)) {
              uniqueVoicesMap.set(v.name, v);
            }
          }
  
          const uniqueVoices = Array.from(uniqueVoicesMap.values()).slice(0, 5);

          setVoices(uniqueVoices);
          localStorage.setItem("heygen_voices", JSON.stringify(uniqueVoices));
        }
      } catch (err) {
        console.error("Error fetching voices:", err);
      }
    };
  
    fetchVoices();
  }, [])
  
  
  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId)
    localStorage.setItem("selected_avatar_id", avatarId)
  }

  const handleInputHover = (inputName: string) => setHoveredInput(inputName)
  const handleInputLeave = () => setHoveredInput(null)

  const handleSubmit = async () => {
    if (!selectedAvatar) return
    setLoading(true)

    const matchData = {
      avatar: selectedAvatar,
      voice: selectedVoice,
      season,
      matchNumber,
      inning,
      over,
    }

    localStorage.setItem("selected_match_data", JSON.stringify(matchData))
    await new Promise((resolve) => setTimeout(resolve, 1500))
    onSelect(selectedAvatar, matchData)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">Cricket Commentary</h1>
          <p className="text-orange-400 text-lg">Select Your Heygen Avatar, Voice & Match Details</p>
        </div>

        {/* Avatar Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Choose Your Avatar</h2>
          <ul className="flex flex-wrap justify-center gap-6">
            {avatars.map((avatar) => (
              <li key={avatar.avatar_id}>
                <button
                  onClick={() => handleAvatarSelect(avatar.avatar_id)}
                  className={`relative group transition-all duration-300 ${
                    selectedAvatar === avatar.avatar_id ? "scale-110" : "hover:scale-105"
                  }`}
                >
                  <div className="p-1 rounded-2xl bg-gradient-to-br from-orange-500/40 to-orange-500/10">
                    <div className="bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center min-h-40 w-32">
                      <img
                        src={avatar.preview_image_url}
                        alt={avatar.avatar_name}
                        className="w-16 h-16 rounded-full mb-2 object-cover"
                      />
                      <p className="text-white font-semibold text-sm text-center">{avatar.avatar_name}</p>
                      {selectedAvatar === avatar.avatar_id && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Voice Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Choose Your Voice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {voices.map((voice) => (
              <div
                key={voice.voice_id}
                onClick={() => setSelectedVoice(voice.voice_id)}
                className={`p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                  selectedVoice === voice.voice_id
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-orange-500/30 hover:border-orange-500/60"
                }`}
              >
                <p className="text-white font-semibold">{voice.name}</p>
                <p className="text-sm text-gray-400">
                  {voice.language} · {voice.gender}
                </p>
                {voice.preview_audio && (
                  <audio
                    controls
                    src={voice.preview_audio}
                    className="mt-2 w-full rounded"
                  >
                    Your browser does not support the audio element.
                  </audio>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Match Details with Earthquake Effect */}
        <div className={`space-y-6 mb-8 transition-transform duration-100 ${hoveredInput ? "shake-animation" : ""}`}>
          {/* Season */}
          <div onMouseEnter={() => handleInputHover("season")} onMouseLeave={handleInputLeave} className="relative group">
            <label className="block text-white font-semibold mb-2">IPL Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="w-full bg-slate-800 border-2 border-orange-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 transition-all duration-300 group-hover:border-orange-500/60 group-hover:shadow-lg group-hover:shadow-orange-500/20"
            >
              {IPL_SEASONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Match Number */}
          <div onMouseEnter={() => handleInputHover("match")} onMouseLeave={handleInputLeave} className="relative group">
            <label className="block text-white font-semibold mb-2">Match Number</label>
            <select
              value={matchNumber}
              onChange={(e) => setMatchNumber(Number(e.target.value))}
              className="w-full bg-slate-800 border-2 border-orange-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 transition-all duration-300 group-hover:border-orange-500/60 group-hover:shadow-lg group-hover:shadow-orange-500/20"
            >
              {MATCH_NUMBERS.map((m) => (
                <option key={m} value={m}>Match {m}</option>
              ))}
            </select>
          </div>

          {/* Inning & Over */}
          <div className="grid grid-cols-1 gap-4">
            <div onMouseEnter={() => handleInputHover("inning")} onMouseLeave={handleInputLeave} className="relative group">
              <label className="block text-white font-semibold mb-2">Inning</label>
              <select
                value={inning}
                onChange={(e) => setInning(Number(e.target.value))}
                className="w-full bg-slate-800 border-2 border-orange-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 transition-all duration-300 group-hover:border-orange-500/60 group-hover:shadow-lg group-hover:shadow-orange-500/20"
              >
                {INNINGS.map((i) => (
                  <option key={i} value={i}>Inning {i}</option>
                ))}
              </select>
            </div>

            {/* <div onMouseEnter={() => handleInputHover("over")} onMouseLeave={handleInputLeave} className="relative group">
              <label className="block text-white font-semibold mb-2">Over</label>
              <select
                value={over}
                onChange={(e) => setOver(Number(e.target.value))}
                className="w-full bg-slate-800 border-2 border-orange-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 transition-all duration-300 group-hover:border-orange-500/60 group-hover:shadow-lg group-hover:shadow-orange-500/20"
              >
                {OVERS.map((o) => (
                  <option key={o} value={o}>Over {o}</option>
                ))}
              </select>
            </div> */}
          </div>
        </div>

        {/* Loading */}
        {loading && <GelSlider />}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!selectedAvatar || loading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading Avatar..." : "Start Commentary"}
        </Button>
      </div>
    </div>
  )
}
