/* ═══════════════════════════════════════════════════════════════
   WeTalk - WebRTC 语音/视频通话 v1.0
   信令通过 Socket.io 传输 (无 LiveKit, 自包含)
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── STUN 服务器 ──────────────────────────────────────────
  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // ─── 通话状态 ─────────────────────────────────────────────
  const CallState = {
    IDLE: 'idle',
    CALLING: 'calling',
    RINGING: 'ringing',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ENDED: 'ended',
  };

  // ─── 模块状态 ─────────────────────────────────────────────
  let state = CallState.IDLE;
  let peerConnection = null;
  let localStream = null;
  let remoteStream = null;
  let callTarget = null;
  let callTargetInfo = null;
  let isVideo = false;
  let isMuted = false;
  let isSpeaker = false;
  let callTimerInterval = null;
  let callStartTime = null;
  let pendingCallInfo = null;
  let autoAnswer = false;

  // ─── 铃声 ─────────────────────────────────────────────────
  let ringtoneCtx = null;
  let ringtoneGain = null;

  function playRingtone() {
    try {
      ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
      ringtoneGain = ringtoneCtx.createGain();
      ringtoneGain.gain.value = 0.25;
      ringtoneGain.connect(ringtoneCtx.destination);

      function playBeep(freq, startDelay, duration) {
        if (!ringtoneCtx) return;
        const osc = ringtoneCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ringtoneCtx.createGain();
        g.gain.setValueAtTime(0.25, ringtoneCtx.currentTime + startDelay);
        g.gain.setValueAtTime(0, ringtoneCtx.currentTime + startDelay + duration);
        osc.connect(g);
        g.connect(ringtoneGain);
        osc.start(ringtoneCtx.currentTime + startDelay);
        osc.stop(ringtoneCtx.currentTime + startDelay + duration + 0.05);
      }

      function schedulePattern() {
        if (!ringtoneCtx || state === CallState.CONNECTED || state === CallState.ENDED || state === CallState.IDLE) return;
        // 600-800-600-800 pattern
        playBeep(600, 0, 0.2);
        playBeep(800, 0.25, 0.2);
        playBeep(600, 0.5, 0.2);
        playBeep(800, 0.75, 0.2);
        setTimeout(schedulePattern, 1200);
      }
      schedulePattern();
    } catch (e) {
      console.warn('[WebRTC] Ringtone unavailable:', e.message);
    }
  }

  function stopRingtone() {
    if (ringtoneCtx) {
      ringtoneCtx.close().catch(function () {});
      ringtoneCtx = null;
    }
  }

  // ─── DOM 构建 ─────────────────────────────────────────────
  var overlay = null;
  var videoContainer = null;
  var localVideo = null;
  var remoteVideo = null;

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'call-overlay';
    overlay.innerHTML =
      '<div class="call-bg"></div>' +
      '<div class="call-card" id="callCard">' +
        '<div class="call-avatar-ring" id="callAvatarRing">' +
          '<div class="call-avatar-text" id="callAvatarText">?</div>' +
        '</div>' +
        '<div class="call-name" id="callName">用户</div>' +
        '<div class="call-status" id="callStatus">正在呼叫...</div>' +
        '<div class="call-timer" id="callTimer" style="display:none">00:00</div>' +
        '<div class="call-buttons" id="callButtons"></div>' +
      '</div>' +
      '<div class="call-video-container" id="callVideoContainer" style="display:none">' +
        '<div class="call-video-remote" id="remoteVideoWrap">' +
          '<video id="remoteVideo" autoplay playsinline></video>' +
        '</div>' +
        '<div class="call-video-local" id="localVideoWrap">' +
          '<video id="localVideo" autoplay playsinline muted></video>' +
        '</div>' +
        '<div class="call-video-controls" id="videoCallControls"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    videoContainer = overlay.querySelector('#callVideoContainer');
    localVideo = overlay.querySelector('#localVideo');
    remoteVideo = overlay.querySelector('#remoteVideo');
  }

  // ─── 辅助 ─────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showToastSafe(msg) {
    if (typeof showToast === 'function') {
      showToast(msg);
    }
  }

  function setAvatar(target) {
    var ring = $('callAvatarRing');
    var text = $('callAvatarText');
    if (target && target.avatar) {
      ring.innerHTML = '<img src="' + target.avatar + '" alt="">';
    } else {
      var ch = (target && target.avatarChar) || '?';
      var bg = (target && target.avatarColor) || '#1aad19';
      text.textContent = ch;
      text.style.background = bg;
      ring.innerHTML = '';
      ring.appendChild(text);
    }
  }

  // ─── 显示 UI ──────────────────────────────────────────────
  function showUI(mode, target) {
    ensureOverlay();
    overlay.classList.add('show');
    videoContainer.style.display = 'none';
    $('callCard').style.display = 'flex';
    setAvatar(target);

    var name = $('callName');
    var status = $('callStatus');
    var timer = $('callTimer');
    var buttons = $('callButtons');
    var ring = $('callAvatarRing');

    name.textContent = (target && target.name) || '用户';
    ring.classList.remove('inactive');

    if (mode === 'outgoing') {
      status.textContent = '正在呼叫...';
      timer.style.display = 'none';
      buttons.innerHTML =
        '<div class="call-btn-wrapper">' +
          '<button class="call-btn call-btn-end" id="callCancelBtn">' +
            '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.9v2.4a1.6 1.6 0 0 1-1.6 1.6h-.3A18.6 18.6 0 0 1 3 3.8v-.3A1.6 1.6 0 0 1 4.6 2h2.4a1 1 0 0 1 1 .9c.3 1.6 1 3.1 1.9 4.4.4.6.3 1.4-.2 1.9l-1 1a14.5 14.5 0 0 0 6.6 6.6l1-1a1.4 1.4 0 0 1 1.9-.2c1.3.9 2.8 1.5 4.4 1.9a1 1 0 0 1 .9 1z"/></svg>' +
          '</button>' +
          '<span class="call-btn-label">取消</span>' +
        '</div>';
      $('callCancelBtn').onclick = function () { endCall(); };
    } else if (mode === 'incoming') {
      var label = target && target.video ? '邀请你视频通话' : '邀请你语音通话';
      status.textContent = label;
      timer.style.display = 'none';
      buttons.innerHTML =
        '<div class="call-btn-wrapper">' +
          '<button class="call-btn call-btn-reject" id="callRejectBtn">' +
            '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
          '<span class="call-btn-label">拒绝</span>' +
        '</div>' +
        '<div class="call-btn-wrapper">' +
          '<button class="call-btn call-btn-accept" id="callAcceptBtn">' +
            '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
          '</button>' +
          '<span class="call-btn-label">接听</span>' +
        '</div>';
      $('callRejectBtn').onclick = function () { rejectIncoming(); };
      $('callAcceptBtn').onclick = function () { acceptIncoming(); };
      playRingtone();
    } else if (mode === 'connected') {
      status.textContent = '';
      timer.style.display = '';
      timer.textContent = '00:00';
      ring.classList.add('inactive');
      stopRingtone();

      if (isVideo) {
        $('callCard').style.display = 'none';
        videoContainer.style.display = 'block';
        renderVideoControls();
      } else {
        buttons.innerHTML =
          '<div class="call-btn-wrapper">' +
            '<button class="call-btn call-btn-secondary" id="callMuteAudioBtn">' +
              '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' +
            '</button>' +
            '<span class="call-btn-label">静音</span>' +
          '</div>' +
          '<div class="call-btn-wrapper">' +
            '<button class="call-btn call-btn-secondary" id="callSpeakerAudioBtn">🔊</button>' +
            '<span class="call-btn-label">扬声器</span>' +
          '</div>' +
          '<div class="call-btn-wrapper">' +
            '<button class="call-btn call-btn-secondary" id="callVideoOnBtn">📹</button>' +
            '<span class="call-btn-label">视频</span>' +
          '</div>' +
          '<div class="call-btn-wrapper">' +
            '<button class="call-btn call-btn-end" id="callHangupAudioBtn">✕</button>' +
            '<span class="call-btn-label">挂断</span>' +
          '</div>';
        $('callMuteAudioBtn').onclick = toggleMute;
        $('callSpeakerAudioBtn').onclick = toggleSpeaker;
        $('callVideoOnBtn').onclick = toggleVideoCall;
        $('callHangupAudioBtn').onclick = function () { endCall(); };
      }
      callStartTime = Date.now();
      startTimer();
    }
  }

  function renderVideoControls() {
    var ctrl = $('videoCallControls');
    ctrl.innerHTML =
      '<div class="call-btn-wrapper">' +
        '<button class="call-btn call-btn-secondary" id="vcMuteBtn">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' +
        '</button>' +
        '<span class="call-btn-label">静音</span>' +
      '</div>' +
      '<div class="call-btn-wrapper">' +
        '<button class="call-btn call-btn-secondary" id="vcSpeakerBtn">🔊</button>' +
        '<span class="call-btn-label">扬声器</span>' +
      '</div>' +
      '<div class="call-btn-wrapper">' +
        '<button class="call-btn call-btn-secondary active" id="vcCamBtn">📹</button>' +
        '<span class="call-btn-label">摄像头</span>' +
      '</div>' +
      '<div class="call-btn-wrapper">' +
        '<button class="call-btn call-btn-end" id="vcHangupBtn">✕</button>' +
        '<span class="call-btn-label">挂断</span>' +
      '</div>';
    $('vcMuteBtn').onclick = toggleMute;
    $('vcSpeakerBtn').onclick = toggleSpeaker;
    $('vcCamBtn').onclick = toggleVideoCall;
    $('vcHangupBtn').onclick = function () { endCall(); };
  }

  function hideUI() {
    if (overlay) overlay.classList.remove('show');
    stopRingtone();
    stopTimer();
  }

  // ─── 计时器 ──────────────────────────────────────────────
  function startTimer() {
    callTimerInterval = setInterval(function () {
      if (!callStartTime) return;
      var e = Math.floor((Date.now() - callStartTime) / 1000);
      var m = String(Math.floor(e / 60)).padStart(2, '0');
      var s = String(e % 60).padStart(2, '0');
      var t = $('callTimer');
      if (t) t.textContent = m + ':' + s;
    }, 1000);
  }

  function stopTimer() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }
    callStartTime = null;
  }

  // ─── getUserMedia ─────────────────────────────────────────
  function getLocalStream(videoEnabled) {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: videoEnabled ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
    }).then(function (stream) {
      localStream = stream;
      if (videoEnabled && localVideo) {
        localVideo.srcObject = stream;
        localVideo.parentElement.classList.add('active');
        localVideo.classList.add('active');
      }
      return stream;
    }).catch(function (err) {
      console.error('[WebRTC] getUserMedia:', err);
      showToastSafe('无法访问麦克风/摄像头: ' + err.message);
      return null;
    });
  }

  // ─── RTCPeerConnection ────────────────────────────────────
  function createPC() {
    if (peerConnection) { peerConnection.close(); }

    var pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = function (e) {
      if (e.candidate && callTarget) {
        socket.emit('call-signal', {
          to: callTarget,
          signal: { type: 'candidate', candidate: e.candidate },
        });
      }
    };

    pc.ontrack = function (e) {
      remoteStream = e.streams[0];
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.parentElement.classList.add('active');
        remoteVideo.classList.add('active');
      }
    };

    pc.oniceconnectionstatechange = function () {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        if (state === CallState.CONNECTED) {
          showToastSafe('通话连接断开');
        }
        endCall();
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(function (t) { pc.addTrack(t, localStream); });
    }

    peerConnection = pc;
    return pc;
  }

  // ─── 发起呼叫 ─────────────────────────────────────────────
  function startCall(targetId, video) {
    if (state !== CallState.IDLE) {
      showToastSafe('当前已有通话进行中');
      return;
    }
    if (!targetId || targetId.startsWith('g_')) {
      showToastSafe('群聊暂不支持通话');
      return;
    }
    var user = (typeof contacts !== 'undefined' && contacts.get) ? contacts.get(targetId) : null;
    if (!user) { showToastSafe('用户不存在'); return; }

    isVideo = video;
    callTarget = targetId;
    callTargetInfo = { name: user.name, avatar: user.avatar, avatarColor: user.avatarColor, avatarChar: user.avatarChar };
    state = CallState.CALLING;

    getLocalStream(video).then(function (stream) {
      if (!stream) { state = CallState.IDLE; return; }
      showUI('outgoing', user);
      createPC();

      pc.createOffer().then(function (offer) {
        return pc.setLocalDescription(offer);
      }).then(function () {
        socket.emit('call-user', {
          to: callTarget,
          signal: pc.localDescription,
          fromName: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '用户',
          video: isVideo,
          avatar: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.avatar : null,
          avatarColor: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.avatarColor : '#1aad19',
          avatarChar: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.avatarChar : '?',
        });
      }).catch(function (err) {
        console.error('[WebRTC] createOffer error:', err);
        showToastSafe('呼叫失败');
        cleanup();
      });
    });
  }

  // ─── 接受来电 ─────────────────────────────────────────────
  function acceptIncoming() {
    if (!pendingCallInfo) return;
    stopRingtone();
    state = CallState.CONNECTING;
    callTarget = pendingCallInfo.from;
    isVideo = !!pendingCallInfo.video;

    getLocalStream(isVideo).then(function (stream) {
      if (!stream) { state = CallState.IDLE; pendingCallInfo = null; return; }
      createPC();

      try {
        pc.setRemoteDescription(new RTCSessionDescription(pendingCallInfo.signal)).then(function () {
          return pc.createAnswer();
        }).then(function (answer) {
          return pc.setLocalDescription(answer);
        }).then(function () {
          socket.emit('accept-call', { to: callTarget, signal: pc.localDescription });
          state = CallState.CONNECTED;
          showUI('connected', { name: pendingCallInfo.fromName });
          pendingCallInfo = null;
        }).catch(function (err) {
          console.error('[WebRTC] acceptIncoming error:', err);
          showToastSafe('接听失败');
          cleanup();
        });
      } catch (err) {
        console.error('[WebRTC] acceptIncoming error:', err);
        showToastSafe('接听失败');
        cleanup();
      }
    });
  }

  // ─── 拒绝来电 ─────────────────────────────────────────────
  function rejectIncoming() {
    stopRingtone();
    if (pendingCallInfo) {
      socket.emit('end-call', { to: pendingCallInfo.from });
    }
    pendingCallInfo = null;
    state = CallState.IDLE;
    hideUI();
    cleanup();
  }

  // ─── 结束通话 ─────────────────────────────────────────────
  function endCall() {
    if (state === CallState.ENDED || state === CallState.IDLE) return;
    var prevTarget = callTarget;
    var wasConnected = state === CallState.CONNECTED;
    state = CallState.ENDED;
    stopRingtone();
    stopTimer();
    hideUI();
    if (prevTarget && (wasConnected || state === CallState.CALLING || state === CallState.RINGING)) {
      socket.emit('end-call', { to: prevTarget });
    }
    cleanup();
  }

  // ─── 清理 ─────────────────────────────────────────────────
  function cleanup() {
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream) { localStream.getTracks().forEach(function (t) { t.stop(); }); localStream = null; }
    if (localVideo) { localVideo.srcObject = null; localVideo.parentElement.classList.remove('active'); localVideo.classList.remove('active'); }
    if (remoteVideo) { remoteVideo.srcObject = null; remoteVideo.parentElement.classList.remove('active'); remoteVideo.classList.remove('active'); }
    if (ringtoneCtx) { ringtoneCtx.close().catch(function () {}); ringtoneCtx = null; }
    state = CallState.IDLE;
    callTarget = null;
    callTargetInfo = null;
    pendingCallInfo = null;
  }

  // ─── 控制按钮 ─────────────────────────────────────────────
  function toggleMute() {
    if (localStream) {
      var t = localStream.getAudioTracks()[0];
      if (t) {
        t.enabled = !t.enabled;
        var btn = $('callMuteAudioBtn') || $('vcMuteBtn');
        if (btn) btn.classList.toggle('active', !t.enabled);
      }
    }
  }

  function toggleSpeaker() {
    isSpeaker = !isSpeaker;
    var btn = $('callSpeakerAudioBtn') || $('vcSpeakerBtn');
    if (btn) btn.classList.toggle('active', isSpeaker);
  }

  function toggleVideoCall() {
    if (!localStream) return;
    var vt = localStream.getVideoTracks()[0];
    if (vt) {
      // turn off video
      vt.stop();
      localStream.removeTrack(vt);
      if (localVideo) {
        localVideo.srcObject = null;
        localVideo.classList.remove('active');
        localVideo.parentElement.classList.remove('active');
      }
      if (peerConnection) {
        var s = peerConnection.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
        if (s) peerConnection.removeTrack(s);
      }
      isVideo = false;
      // switch to audio UI
      videoContainer.style.display = 'none';
      $('callCard').style.display = 'flex';
      showUI('connected', callTargetInfo);
    } else {
      // turn on video
      navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } })
        .then(function (newStream) {
          var newTrack = newStream.getVideoTracks()[0];
          localStream.addTrack(newTrack);
          if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.classList.add('active');
            localVideo.parentElement.classList.add('active');
          }
          if (peerConnection) {
            peerConnection.addTrack(newTrack, localStream);
          }
          isVideo = true;
          // switch to video UI
          $('callCard').style.display = 'none';
          videoContainer.style.display = 'block';
          renderVideoControls();
        })
        .catch(function (err) {
          console.error('[WebRTC] enable video:', err);
          showToastSafe('无法开启摄像头');
        });
    }
  }

  // ─── Socket.io 事件 ───────────────────────────────────────
  function bindEvents() {
    socket.on('call-incoming', function (data) {
      if (state !== CallState.IDLE) {
        socket.emit('end-call', { to: data.from });
        return;
      }
      callTarget = data.from;
      pendingCallInfo = {
        from: data.from,
        fromName: data.fromName,
        signal: data.signal,
        video: data.video,
        avatar: data.avatar,
        avatarColor: data.avatarColor,
        avatarChar: data.avatarChar,
      };
      if (autoAnswer && !data.video) {
        acceptIncoming();
        return;
      }
      state = CallState.RINGING;
      showUI('incoming', {
        name: data.fromName || '用户',
        avatar: data.avatar,
        avatarColor: data.avatarColor,
        avatarChar: data.avatarChar,
        video: data.video,
      });
    });

    socket.on('call-accepted', function (data) {
      if (state !== CallState.CALLING) return;
      stopRingtone();
      state = CallState.CONNECTING;
      pc.setRemoteDescription(new RTCSessionDescription(data.signal))
        .then(function () {
          state = CallState.CONNECTED;
          showUI('connected', callTargetInfo);
        })
        .catch(function (err) {
          console.error('[WebRTC] set remote desc:', err);
          showToastSafe('连接失败');
          cleanup();
        });
    });

    socket.on('call-signal', function (data) {
      if (!peerConnection || state === CallState.IDLE || state === CallState.ENDED) return;
      try {
        if (data.signal.type === 'candidate') {
          peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      } catch (err) {
        console.error('[WebRTC] add ICE:', err);
      }
    });

    socket.on('call-ended', function (data) {
      if (state === CallState.CONNECTED || state === CallState.CALLING || state === CallState.RINGING) {
        stopRingtone();
        state = CallState.ENDED;
        hideUI();
        cleanup();
        showToastSafe('通话已结束');
      }
    });
  }

  // ─── 添加通话按钮到聊天头部 ───────────────────────────────
  function addButtons() {
    var actions = document.querySelector('.chat-header-actions');
    if (!actions) return;

    // voice button
    var vb = document.createElement('button');
    vb.className = 'header-btn';
    vb.title = '语音通话';
    vb.id = 'voiceCallBtn';
    vb.style.display = 'none';
    vb.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

    // video button
    var vcb = document.createElement('button');
    vcb.className = 'header-btn';
    vcb.title = '视频通话';
    vcb.id = 'videoCallBtn';
    vcb.style.display = 'none';
    vcb.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';

    var menuBtn = document.getElementById('chatMenuBtn');
    if (menuBtn) {
      actions.insertBefore(vcb, menuBtn);
      actions.insertBefore(vb, vcb);
    } else {
      actions.appendChild(vb);
      actions.appendChild(vcb);
    }

    vb.onclick = function () {
      var id = (typeof activeChat !== 'undefined') ? activeChat : null;
      if (!id || id.startsWith('g_')) { showToastSafe('群聊暂不支持通话'); return; }
      startCall(id, false);
    };
    vcb.onclick = function () {
      var id = (typeof activeChat !== 'undefined') ? activeChat : null;
      if (!id || id.startsWith('g_')) { showToastSafe('群聊暂不支持通话'); return; }
      startCall(id, true);
    };

    // patch updateChatHeader to show/hide buttons
    if (typeof window.updateChatHeader === 'function') {
      var orig = window.updateChatHeader;
      window.updateChatHeader = function (userId) {
        orig(userId);
        var isGroup = userId && userId.startsWith('g_');
        vb.style.display = isGroup ? 'none' : '';
        vcb.style.display = isGroup ? 'none' : '';
      };
    }
  }

  // ─── 初始化 ───────────────────────────────────────────────
  function init() {
    ensureOverlay();
    bindEvents();

    // wait for chat header to exist, then add buttons
    var check = setInterval(function () {
      var actions = document.querySelector('.chat-header-actions');
      if (actions && !document.getElementById('voiceCallBtn')) {
        addButtons();
        clearInterval(check);
      }
      // also stop if no socket (e.g. not logged in)
      if (!document.querySelector('.chat-header')) {
        clearInterval(check);
      }
    }, 300);
  }

  // ─── 公共 API ─────────────────────────────────────────────
  window.WeTalkCall = {
    voiceCall: function (targetId) { startCall(targetId, false); },
    videoCall: function (targetId) { startCall(targetId, true); },
    endCall: endCall,
    getState: function () { return state; },
    setAutoAnswer: function (enabled) { autoAnswer = enabled; },
    getAutoAnswer: function () { return autoAnswer; },
    init: init,
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[WebRTC] 模块已加载');
})();
