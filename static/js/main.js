console.log('In Main Js File');

var mapPeers = {};
var webSocket;
var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');
var peerUsername;
var username;

var allUsernames=[];

function webSocketOnMessage(e) {
    var parsedData = JSON.parse(e.data);

    peerUsername = parsedData['peer'];
    var action = parsedData['action'];

    if (username == peerUsername) {
        return;
    }

    var receiver_channel_name = parsedData['message']['receiver_channel_name'];
    if (action == 'new-peer') {
        createOfferer(peerUsername, receiver_channel_name);

        return;
    }

    if (action == 'new-offer') {
        var offer = parsedData['message']['sdp'];
        createAnswerer(offer, peerUsername, receiver_channel_name);
        return;
    }

    if(action== 'new-answer'){
        var answer = parsedData['message']['sdp'];

        var peer = mapPeers[peerUsername][0];

        peer.setRemoteDescription(answer);

        return;
    }
}

btnJoin.addEventListener('click', () => {
    username = usernameInput.value;

    if (username == '') {
        return
    }

    usernameInput.value = '';
    usernameInput.disabled = true;
    usernameInput.style.visibility = 'hidden';
    btnJoin.style.visibility = 'hidden';

    var labelusername = document.querySelector('#label-username');
    labelusername.innerHTML = username;


    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol == 'https:') {
        var wsStart = 'wss://';
    }
    var endpoint = wsStart + loc.host + loc.pathname;
    console.log('endpoint: ', endpoint);

    webSocket = new WebSocket(endpoint);

    webSocket.addEventListener('open', (e) => {
        console.log('Connection Opened For WebSocket!'); 
    
        sendSignal('new-peer',{});
    });

    webSocket.addEventListener('close', (e) => {
        console.log('Connection Closed For WebSocket!');
    });
    webSocket.addEventListener('message', webSocketOnMessage);

    webSocket.addEventListener('error', (e) => {
        console.log('Error Occured!');
    });

});


// .............................................................................................................................

var localStream = new MediaStream();

const constraints = {
    'video': true,
    'audio': true
};

const localVideo = document.querySelector('#local-video');

const btnToggleAudio = document.querySelector('#btn-toggle-audio');

const btnToggleVideo = document.querySelector('#btn-toggle-video');

var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.muted = true;

        var audioTracks = stream.getAudioTracks();
        var videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click',()=>{
            audioTracks[0].enabled = !audioTracks[0].enabled;
            // console.log('Audio track : ',audioTracks[0].enabled)
            if(audioTracks[0].enabled){
                btnToggleAudio.innerHTML = 'Audio Mute';
                return;
            }
            btnToggleAudio.innerHTML = 'Audio Unmute';
        });

        btnToggleVideo.addEventListener('click',()=>{
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if(videoTracks[0].enabled){
                btnToggleVideo.innerHTML = 'Video Off';
                return;
            } 
            btnToggleVideo.innerHTML = 'Video On';
        });

    })
    .catch(e => {
        console.log('Error Accessing media devices');
    });

var btnSendMsg = document.querySelector('#btn-msg');
var messageList = document.querySelector('#message-list');
var messageInput = document.querySelector('#msg');

btnSendMsg.addEventListener('click',sendMsgOnClick);

function sendMsgOnClick(){
    var message = messageInput.value;

    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me: ' + message));
    messageList.appendChild(li);

    var  dataChannels = getDataChannels();

    message = username + ': ' + message;
    
    // ......................................................
    allUsernames.push(username);

    for(index in dataChannels){
        dataChannels[index].send(message);
        dataChannels[index].send(allUsernames);
        console.log(allUsernames);
    }

    messageInput.value = ''; 
}


function sendSignal(action, message) {
    var str = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message,
    });
    console.log('sendsignle function called......................');
    webSocket.send(str);
}

function createOfferer(peerUsername, receiver_channel_name) {
    var peer = new RTCPeerConnection(null);

    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel');
    dc.addEventListener('open', () => {
        console.log('Connection Opened in create offerer!');
    });
    dc.addEventListener('message', dcOnMessage);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc];

    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }

            removeVideo(remoteVideo);
        }
    });
    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log('new  ice candidate: ', JSON.stringify(peer.localDescription));

            return;
        }
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        });
    });

    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
        console.log('Local  description set successfully')
    });
}

function createAnswerer(offer, peerUsername, receiver_channel_name) {
    var peer = new RTCPeerConnection(null);

    addLocalTracks(peer);

    // dc.addEve ntListener('message', dcOnMessage);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open', () => {
            console.log('Connection Opened!');
        });
        peer.dc.addEventListener('message', dcOnMessage);
        mapPeers[peerUsername] = [peer, peer.dc];
    });


    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }

            removeVideo(remoteVideo);
        }
    });
    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log('new  ice candidate: ', JSON.stringify(peer.localDescription));

            return;
        }
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name,
        });
    });

    peer.setRemoteDescription(offer)
        .then(()=>{
            console.log('Remote description set successfully for %s', peerUsername);
            
            return peer.createAnswer();
        })
        .then(a=>{
            console.log('answer created');
            peer.setLocalDescription(a);
        });

}


function addLocalTracks(peer) {
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
    return;
}

function dcOnMessage(e) {
    var message = e.data;

    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);    
}

function createVideo(peerUsername) {
    var videoContainer = document.querySelector('#video-container');

    var remoteVideo = document.createElement('video');

    remoteVideo.id = peerUsername + '-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;

    var videoWrapper = document.createElement('div');
    videoContainer.appendChild(videoWrapper);
    videoWrapper.appendChild(remoteVideo);

    return remoteVideo;
}

function setOnTrack(peer, remoteVideo) {
    var remoteStream = new MediaStream();

    remoteVideo.srcObject = remoteStream;

    peer.addEventListener('track', async (e) => {
        remoteStream.addTrack(e.track, remoteStream);
    })
}


function removeVideo(video) {
    var videoWrapper = video.parentNode;

    videoWrapper.parentNode.removeChild(videoWrapper);
}

function getDataChannels(){
    var dataChannels = [];

    for(peerUsername in mapPeers){
        var dataChannel = mapPeers[peerUsername][1];

        dataChannels.push(dataChannel);
    }
    console.log('this is all datachannels: ',dataChannels);
    return dataChannels;
}

var users = document.getElementsByClassName('user-name-btn');
users.addEventListener('click',()=>{
    var userlist = document.querySelector('.user-list');
    userlist.innerHTML = ''; // Clear the previous list

    for(name1 in allUsernames){
        var li = document.createElement('li');
        li.appendChild(document.createTextNode(name1));
        userlist.appendChild(li);
        console.log(allUsernames);
        console.log('.....................................................',userlist);
    }
  
});


// mcu and sfu