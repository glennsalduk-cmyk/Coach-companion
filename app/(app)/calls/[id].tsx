import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, SafeAreaView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AudioSession, LiveKitRoom, useLocalParticipant, useTracks, VideoTrack } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { livekitUrl, mintLiveKitToken } from '@/lib/livekit';
import { colors, spacing } from '@/lib/theme';
import { getErrorMessage } from '@/lib/errors';
import type { Profile, VideoCall } from '@/lib/database.types';

const CALL_BG = '#151020';

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [call, setCall] = useState<VideoCall | null>(null);
  const [peer, setPeer] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  const setup = useCallback(async () => {
    if (!id || !profile) return;
    setError(null);
    setLoading(true);

    const { data: callData, error: callError } = await supabase
      .from('video_calls')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (callError || !callData) {
      setError(callError?.message ?? 'Appel introuvable.');
      setLoading(false);
      return;
    }
    const typedCall = callData as VideoCall;
    setCall(typedCall);

    const peerId = typedCall.coach_id === profile.id ? typedCall.client_id : typedCall.coach_id;
    const { data: peerData } = await supabase.from('profiles').select('*').eq('id', peerId).maybeSingle();
    setPeer(peerData as Profile | null);

    try {
      const minted = await mintLiveKitToken(typedCall.id);
      setToken(minted.token);
      if (typedCall.status === 'ringing') {
        await supabase.from('video_calls').update({ status: 'active' }).eq('id', typedCall.id);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de rejoindre l’appel.'));
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void setup();
  }, [setup]);

  const handleEnd = useCallback(async () => {
    if (call && call.status !== 'ended') {
      await supabase
        .from('video_calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', call.id);
    }
    router.back();
  }, [call, router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CALL_BG }}>
        <ActivityIndicator color="white" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (error || !token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: CALL_BG, padding: spacing.xl }}>
        <Text style={{ color: 'white', marginTop: 80, fontSize: 14 }}>
          {error ?? 'Impossible de rejoindre l’appel.'}
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.xl }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      audio
      video
      connect
      onDisconnected={handleEnd}
    >
      <CallUI peerName={peer?.full_name || 'Appel'} onEnd={handleEnd} />
    </LiveKitRoom>
  );
}

function CallUI({ peerName, onEnd }: { peerName: string; onEnd: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const localTrack = tracks.find((t) => t.participant.isLocal);
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);
  const [speakerOn, setSpeakerOn] = useState(true);

  async function toggleSpeaker() {
    const nextOn = !speakerOn;
    try {
      const outputs = await AudioSession.getAudioOutputs();
      const target =
        Platform.OS === 'ios'
          ? nextOn
            ? 'default'
            : 'force_speaker'
          : nextOn
            ? (outputs.find((o) => o === 'speaker') ?? outputs[0])
            : (outputs.find((o) => o === 'earpiece') ?? outputs[0]);
      if (target) await AudioSession.selectAudioOutput(target);
    } catch (err) {
      // best-effort : certains devices/simulateurs n'exposent pas ces routes,
      // on garde quand même le changement d'état visuel.
      console.warn('[calls] routage audio impossible', err);
    }
    setSpeakerOn(nextOn);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: CALL_BG }}>
      <View style={{ paddingTop: 8, paddingBottom: 14, paddingHorizontal: 20, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{peerName}</Text>
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        {remoteTrack ? (
          <VideoTrack trackRef={remoteTrack} style={{ flex: 1 }} objectFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>En attente de {peerName}…</Text>
          </View>
        )}

        {localTrack && isCameraEnabled ? (
          <VideoTrack
            trackRef={localTrack}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 84,
              height: 112,
              borderRadius: 16,
              overflow: 'hidden',
            }}
            mirror
            objectFit="cover"
          />
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16,
          paddingVertical: 22,
          paddingBottom: 36,
        }}
      >
        <CallButton
          active={!isMicrophoneEnabled}
          label={isMicrophoneEnabled ? 'Muet' : 'Muté'}
          onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <CallButton
          active={!isCameraEnabled}
          label={isCameraEnabled ? 'Caméra' : 'Off'}
          onPress={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        />
        <CallButton active={!speakerOn} label={speakerOn ? 'HP' : 'Écouteur'} onPress={() => void toggleSpeaker()} />
        <CallButton hangup label="Fin" onPress={onEnd} />
      </View>
    </SafeAreaView>
  );
}

function CallButton({
  label,
  onPress,
  active,
  hangup,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  hangup?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hangup ? colors.coral : active ? colors.coral : 'rgba(255,255,255,0.14)',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
}
