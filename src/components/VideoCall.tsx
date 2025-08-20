'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface VideoCallProps {
  roomId: string;
  onEndCall: () => void;
}

interface PeerConnection {
  id: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export function VideoCall({ roomId, onEndCall }: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareSupported, setScreenShareSupported] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'permission-denied'
  >('connecting');
  const [participants, setParticipants] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const peerConnections = useRef<Map<string, PeerConnection>>(new Map());
  const { toast } = useToast();

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  useEffect(() => {
    const checkScreenShareSupport = () => {
      const isSupported = !!(
        navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia
      );
      setScreenShareSupported(isSupported);
      console.log('[v0] Screen share supported:', isSupported);
    };

    checkScreenShareSupport();
  }, []);

  const initializeMedia = async () => {
    setConnectionStatus('connecting');

    try {
      console.log('[v0] Requesting media permissions...');
      console.log('[v0] Current protocol:', window.location.protocol);
      console.log('[v0] User agent:', navigator.userAgent);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia не поддерживается в этом браузере');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log('[v0] Media permissions granted, setting up stream...');
      console.log(
        '[v0] Stream tracks:',
        stream.getTracks().map((t) => `${t.kind}: ${t.enabled}`)
      );

      setLocalStream(stream);
      setConnectionStatus('connected');

      toast({
        title: 'Медиа инициализировано',
        description: 'Камера и микрофон подключены',
      });
    } catch (error: any) {
      console.error('[v0] Error accessing media devices:', error);
      console.error('[v0] Error name:', error.name);
      console.error('[v0] Error message:', error.message);

      let errorMessage = 'Не удалось получить доступ к камере или микрофону';

      if (
        error.name === 'NotAllowedError' ||
        error.name === 'PermissionDeniedError'
      ) {
        errorMessage =
          'Доступ к камере и микрофону запрещен. Проверьте настройки браузера и разрешите доступ для этого сайта.';
        setConnectionStatus('permission-denied');
      } else if (error.name === 'NotFoundError') {
        errorMessage =
          'Камера или микрофон не найдены. Проверьте подключение устройств.';
        setConnectionStatus('disconnected');
      } else if (error.name === 'NotReadableError') {
        errorMessage =
          'Камера или микрофон уже используются другим приложением';
        setConnectionStatus('disconnected');
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Ваш браузер не поддерживает доступ к медиа-устройствам';
        setConnectionStatus('disconnected');
      } else if (error.message.includes('не поддерживается')) {
        errorMessage = error.message;
        setConnectionStatus('disconnected');
      } else {
        errorMessage = `Ошибка: ${error.message}`;
        setConnectionStatus('disconnected');
      }

      toast({
        title: 'Ошибка доступа к медиа',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const createPeerConnection = useCallback(
    (peerId: string) => {
      const pc = new RTCPeerConnection(rtcConfig);

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStreams((prev) => new Map(prev.set(peerId, remoteStream)));

        const videoElement = remoteVideoRefs.current.get(peerId);
        if (videoElement) {
          videoElement.srcObject = remoteStream;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('ICE candidate:', event.candidate);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`Peer ${peerId} connection state:`, pc.connectionState);
        if (pc.connectionState === 'connected') {
          setParticipants((prev) => [
            ...prev.filter((id) => id !== peerId),
            peerId,
          ]);
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed'
        ) {
          setParticipants((prev) => prev.filter((id) => id !== peerId));
          setRemoteStreams((prev) => {
            const newMap = new Map(prev);
            newMap.delete(peerId);
            return newMap;
          });
        }
      };

      const peerConnection: PeerConnection = {
        id: peerId,
        connection: pc,
      };

      peerConnections.current.set(peerId, peerConnection);
      return pc;
    },
    [localStream]
  );

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);

        toast({
          title: audioTrack.enabled ? 'Микрофон включен' : 'Микрофон выключен',
          description: audioTrack.enabled
            ? 'Вас теперь слышно участникам'
            : 'Ваш микрофон отключен',
        });
      }
    }
  }, [localStream, toast]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);

        toast({
          title: videoTrack.enabled ? 'Видео включено' : 'Видео выключено',
          description: videoTrack.enabled
            ? 'Ваше видео теперь видно участникам'
            : 'Ваше видео скрыто от участников',
        });
      }
    }
  }, [localStream, toast]);

  const toggleScreenShare = useCallback(async () => {
    if (!screenShareSupported) {
      toast({
        title: 'Демонстрация экрана недоступна',
        description: 'Ваш браузер не поддерживает демонстрацию экрана',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isScreenSharing) {
        console.log('[v0] Stopping screen share...');

        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }

        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(cameraStream);
        setIsScreenSharing(false);
        setIsVideoEnabled(true);

        peerConnections.current.forEach(({ connection }) => {
          const sender = connection
            .getSenders()
            .find((s) => s.track?.kind === 'video');
          if (sender && cameraStream.getVideoTracks()[0]) {
            sender.replaceTrack(cameraStream.getVideoTracks()[0]);
          }
        });

        toast({
          title: 'Демонстрация экрана остановлена',
          description: 'Переключились обратно на камеру',
        });
      } else {
        console.log('[v0] Starting screen share...');

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        if (localStream) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            screenStream.addTrack(audioTrack);
          }
        }

        setLocalStream(screenStream);
        setIsScreenSharing(true);

        peerConnections.current.forEach(({ connection }) => {
          const sender = connection
            .getSenders()
            .find((s) => s.track?.kind === 'video');
          if (sender && screenStream.getVideoTracks()[0]) {
            sender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });

        screenStream.getVideoTracks()[0].onended = () => {
          console.log('[v0] Screen share ended by user');
          toggleScreenShare();
        };

        toast({
          title: 'Демонстрация экрана запущена',
          description: 'Участники видят ваш экран',
        });
      }
    } catch (error: any) {
      console.error('[v0] Error toggling screen share:', error);

      if (
        error.message &&
        error.message.includes('disallowed by permissions policy')
      ) {
        console.log(
          '[v0] Screen share blocked by permissions policy - this is expected in some environments'
        );
        return;
      }

      let errorMessage = 'Не удалось запустить демонстрацию экрана';

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Доступ к демонстрации экрана запрещен';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Демонстрация экрана не поддерживается';
      } else {
        errorMessage = `Ошибка: ${error.message}`;
      }

      toast({
        title: 'Ошибка демонстрации экрана',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [isScreenSharing, localStream, screenShareSupported, toast]);

  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    peerConnections.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnections.current.clear();

    setRemoteStreams(new Map());
    setParticipants([]);
  }, [localStream]);

  useEffect(() => {
    initializeMedia();
    return cleanup;
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('[v0] Setting video srcObject...');
      localVideoRef.current.srcObject = localStream;

      localVideoRef.current.onloadedmetadata = () => {
        console.log(
          '[v0] Video metadata loaded, dimensions:',
          localVideoRef.current?.videoWidth,
          'x',
          localVideoRef.current?.videoHeight
        );
        setConnectionStatus('connected');
      };

      localVideoRef.current.oncanplay = () => {
        console.log('[v0] Video can play');
      };

      localVideoRef.current.onerror = (e) => {
        console.error('[v0] Video error:', e);
      };

      localVideoRef.current.play().catch((e) => {
        console.error('[v0] Video play error:', e);
      });
    } else if (localStream && !localVideoRef.current) {
      console.log(
        '[v0] Stream ready but video ref not available yet, will retry...'
      );
    }
  }, [localStream]);

  const handleEndCall = useCallback(() => {
    cleanup();
    onEndCall();
  }, [cleanup, onEndCall]);

  const simulateRemotePeer = useCallback(() => {
    const peerId = `peer-${Date.now()}`;
    createPeerConnection(peerId);

    setTimeout(() => {
      toast({
        title: 'Участник присоединился',
        description: `Пользователь ${peerId} присоединился к звонку`,
      });
    }, 1000);
  }, [createPeerConnection, toast]);

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Badge
          variant={
            connectionStatus === 'connected'
              ? 'default'
              : connectionStatus === 'permission-denied'
              ? 'destructive'
              : 'secondary'
          }
          className='text-sm'
        >
          {connectionStatus === 'connecting' && 'Подключение...'}
          {connectionStatus === 'connected' &&
            `Подключено • ${participants.length + 1} участник(ов)`}
          {connectionStatus === 'disconnected' && 'Отключено'}
          {connectionStatus === 'permission-denied' && 'Нет разрешений'}
        </Badge>

        <Button
          variant='outline'
          size='sm'
          onClick={simulateRemotePeer}
          className='text-xs bg-transparent'
        >
          Добавить участника (демо)
        </Button>
      </div>

      {connectionStatus === 'permission-denied' && (
        <Card className='p-6 border-red-500'>
          <div className='space-y-4 text-center'>
            <PhoneOff className='h-12 w-12 mx-auto text-red-500' />
            <div>
              <h3 className='font-medium text-red-500 mb-2'>
                Доступ к камере и микрофону заблокирован
              </h3>
              <p className='text-sm text-gray-600 mb-4'>
                Разрешения были отклонены ранее. Чтобы использовать видеозвонки,
                необходимо разрешить доступ в настройках браузера.
              </p>

              <div className='bg-gray-100 p-4 rounded-lg text-left space-y-2'>
                <p className='font-medium text-sm'>Как разрешить доступ:</p>
                <ol className='text-xs space-y-1 list-decimal list-inside text-gray-600'>
                  <li>
                    Нажмите на иконку замка или камеры в адресной строке
                    браузера
                  </li>
                  <li>Выберите "Разрешить" для камеры и микрофона</li>
                  <li>Обновите страницу или нажмите "Попробовать снова"</li>
                </ol>
                <p className='text-xs text-gray-600 mt-2'>
                  Альтернативно: Настройки браузера → Конфиденциальность →
                  Разрешения сайтов → Камера/Микрофон
                </p>
              </div>
            </div>

            <div className='flex gap-2 justify-center'>
              <Button
                onClick={() => window.location.reload()}
                variant='outline'
                size='sm'
              >
                Обновить страницу
              </Button>
              <Button onClick={initializeMedia} size='sm'>
                Попробовать снова
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Card className='relative overflow-hidden bg-black'>
          {connectionStatus === 'connected' ? (
            <>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className='w-full h-64 object-cover'
                style={{ backgroundColor: '#000' }}
                onLoadedData={() => console.log('[v0] Video loaded data')}
                onPlay={() => console.log('[v0] Video started playing')}
                onError={(e) => console.error('[v0] Video element error:', e)}
              />
              <div className='absolute bottom-2 left-2'>
                <Badge variant='secondary' className='text-xs'>
                  {isScreenSharing ? 'Ваш экран' : 'Вы'}
                </Badge>
              </div>
              {!isVideoEnabled && !isScreenSharing && (
                <div className='absolute inset-0 bg-gray-800 flex items-center justify-center'>
                  <VideoOff className='h-12 w-12 text-gray-400' />
                </div>
              )}
            </>
          ) : (
            <div className='w-full h-64 flex items-center justify-center bg-gray-800'>
              <div className='text-center text-gray-400'>
                {connectionStatus === 'connecting' && (
                  <>
                    <Video className='h-12 w-12 mx-auto mb-2 opacity-50' />
                    <p className='text-sm'>Подключение к камере...</p>
                  </>
                )}
                {connectionStatus === 'permission-denied' && (
                  <>
                    <PhoneOff className='h-12 w-12 mx-auto mb-2' />
                    <p className='text-sm'>Нет доступа к камере</p>
                  </>
                )}
                {connectionStatus === 'disconnected' && (
                  <>
                    <VideoOff className='h-12 w-12 mx-auto mb-2' />
                    <p className='text-sm'>Камера недоступна</p>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>

        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
          <Card key={peerId} className='relative overflow-hidden bg-black'>
            <video
              ref={(el) => {
                if (el) {
                  remoteVideoRefs.current.set(peerId, el);
                  el.srcObject = stream;
                }
              }}
              autoPlay
              playsInline
              className='w-full h-64 object-cover'
            />
            <div className='absolute bottom-2 left-2'>
              <Badge variant='secondary' className='text-xs'>
                {peerId}
              </Badge>
            </div>
          </Card>
        ))}

        {remoteStreams.size === 0 && (
          <Card className='relative overflow-hidden bg-gray-100 dark:bg-gray-800'>
            <div className='w-full h-64 flex items-center justify-center'>
              <div className='text-center text-gray-500'>
                <Video className='h-12 w-12 mx-auto mb-2 opacity-50' />
                <p className='text-sm'>Ожидание участников...</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {connectionStatus === 'connected' && (
        <div className='flex justify-center gap-2'>
          <Button
            variant={isAudioEnabled ? 'default' : 'destructive'}
            size='lg'
            onClick={toggleAudio}
            className='rounded-full w-12 h-12 p-0'
          >
            {isAudioEnabled ? (
              <Mic className='h-5 w-5' />
            ) : (
              <MicOff className='h-5 w-5' />
            )}
          </Button>

          <Button
            variant={isVideoEnabled ? 'default' : 'destructive'}
            size='lg'
            onClick={toggleVideo}
            className='rounded-full w-12 h-12 p-0'
            disabled={isScreenSharing}
          >
            {isVideoEnabled ? (
              <Video className='h-5 w-5' />
            ) : (
              <VideoOff className='h-5 w-5' />
            )}
          </Button>

          {screenShareSupported && (
            <Button
              variant={isScreenSharing ? 'secondary' : 'default'}
              size='lg'
              onClick={toggleScreenShare}
              className='rounded-full w-12 h-12 p-0'
            >
              {isScreenSharing ? (
                <MonitorOff className='h-5 w-5' />
              ) : (
                <Monitor className='h-5 w-5' />
              )}
            </Button>
          )}

          <Button
            variant='destructive'
            size='lg'
            onClick={handleEndCall}
            className='rounded-full w-12 h-12 p-0'
          >
            <PhoneOff className='h-5 w-5' />
          </Button>
        </div>
      )}
    </div>
  );
}
