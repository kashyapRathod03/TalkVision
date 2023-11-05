import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'Test-Room'
        print('connect function called.....................................................')

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        print('group room name: ', self.room_group_name)
        print('channel name: ', self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        print('Disconnected')

    async def receive(self, text_data):
        receive_dict = json.loads(text_data)
        message = receive_dict['message']
        action = receive_dict['action']

        if(action == 'new-offer') or (action == 'new-answer'):
            receiver_channel_name = receive_dict['message']['receiver_channel_name']
            receive_dict['message']['receiver_channel_name'] = self.channel_name
            print('receive function called in  if condition.....................................................')
            print('receive channelame :    ',receiver_channel_name)
            print('receive dict :    ',receive_dict)


            await self.channel_layer.send(
                receiver_channel_name,
                {
                    'type':'send.sdp',
                    'receive_dict':receive_dict
                }
            )

            return
    

        receive_dict['message']['receiver_channel_name'] = self.channel_name
        print('receive function called.....................................................')

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type':'send.sdp',
                'receive_dict':receive_dict
            }
        )
        print('channel layer info...',self.channel_layer)
        print('receive dict after messages:    ',self.room_group_name)
        print('receive dict after messages:    ',receive_dict)
    
    async def send_sdp(self,event):
        receive_dict = event['receive_dict']
        print('send sdp function called.....................................................')

        await self.send(text_data=json.dumps(receive_dict))