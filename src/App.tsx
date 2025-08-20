'use client';

import { useState } from 'react';
import { VideoCall } from './components/VideoCall';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Input } from './components/ui/Input';
import { Badge } from './components/ui/Badge';
import { Phone, PhoneOff, Video, Copy, Check } from 'lucide-react';
import { useToast } from './hooks/useToast';
import './App.css';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 15);
    setRoomId(id);
    return id;
  };

  const startCall = () => {
    const id = roomId || generateRoomId();
    setCurrentRoomId(id);
    setIsInCall(true);
    toast({
      title: 'Звонок начат',
      description: `ID комнаты: ${id}`,
    });
  };

  const joinCall = () => {
    if (!roomId.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите ID комнаты',
        variant: 'destructive',
      });
      return;
    }
    setCurrentRoomId(roomId);
    setIsInCall(true);
    toast({
      title: 'Подключение к звонку',
      description: `ID комнаты: ${roomId}`,
    });
  };

  const endCall = () => {
    setIsInCall(false);
    setCurrentRoomId('');
    setRoomId('');
    toast({
      title: 'Звонок завершен',
      description: 'Вы покинули комнату',
    });
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(currentRoomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Скопировано!',
        description: 'ID комнаты скопирован в буфер обмена',
      });
    } catch (err) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скопировать ID комнаты',
        variant: 'destructive',
      });
    }
  };

  if (isInCall) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <div className='container mx-auto p-4'>
          <div className='mb-4 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Badge variant='secondary' className='text-sm'>
                ID комнаты: {currentRoomId}
              </Badge>
              <Button
                variant='outline'
                size='sm'
                onClick={copyRoomId}
                className='h-8 bg-transparent'
              >
                {copied ? (
                  <Check className='h-4 w-4' />
                ) : (
                  <Copy className='h-4 w-4' />
                )}
              </Button>
            </div>
            <Button
              variant='destructive'
              onClick={endCall}
              className='flex items-center gap-2'
            >
              <PhoneOff className='h-4 w-4' />
              Завершить звонок
            </Button>
          </div>
          <VideoCall roomId={currentRoomId} onEndCall={endCall} />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <div className='text-center p-6 pb-4'>
          <h1 className='text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2'>
            Видеозвонки
          </h1>
          <p className='text-gray-600 dark:text-gray-400'>
            Создайте новую комнату или присоединитесь к существующей
          </p>
        </div>
        <div className='p-6 pt-0 space-y-4'>
          <div className='space-y-2'>
            <Input
              placeholder='Введите ID комнаты'
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className='text-center'
            />
          </div>

          <div className='space-y-2'>
            <Button
              onClick={startCall}
              className='w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700'
            >
              <Video className='h-4 w-4' />
              Создать новую комнату
            </Button>

            <Button
              onClick={joinCall}
              variant='outline'
              className='w-full flex items-center gap-2 bg-transparent'
              disabled={!roomId.trim()}
            >
              <Phone className='h-4 w-4' />
              Присоединиться к комнате
            </Button>
          </div>

          <div className='text-center text-sm text-gray-600 dark:text-gray-400'>
            <p>Для видеозвонков требуется доступ к камере и микрофону</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
