
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:crypto/crypto.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() => runApp(const UdcpApp());

class UdcpApp extends StatelessWidget {
  const UdcpApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'UDCP v4', theme: ThemeData.dark(useMaterial3: true), home: const HomePage(),
  );
}

// ──────────────────────────────────────────────────────────────
// UDCP CLIENT
// ──────────────────────────────────────────────────────────────
class UdcpClient {
  final String host;
  final int httpPort, wsPort, udpPort;
  WebSocketChannel? _ws;
  RawDatagramSocket? _udp;
  final _udpRx = StreamController<String>.broadcast();
  final _wsRx = StreamController<String>.broadcast();
  final _msgSeq = 0;
  String _token = 'secret-token';
  String _secret = 'shared-hmac-secret';

  UdcpClient({this.host = '192.168.1.100', this.httpPort = 3000, this.wsPort = 8080, this.udpPort = 9000});

  Future<void> connect() async {
    _ws = WebSocketChannel.connect(Uri.parse('ws://$host:$wsPort'));
    _ws!.stream.listen((d) => _wsRx.add(d as String));

    _udp = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
    _udp!.listen((_) {
      final dg = _udp!.receive();
      if (dg != null) _udpRx.add(String.fromCharCodes(dg.data));
    });
  }

  String _hmac(String data) {
    final key = utf8.encode(_secret);
    final bytes = utf8.encode(data);
    return Hmac(sha256, key).convert(bytes).toString();
  }

  Map<String, dynamic> _buildBase(String type, String name, int qos, String stream, List<String> route, Map<String, dynamic> value) {
    final ts = DateTime.now().millisecondsSinceEpoch;
    final nonce = 'n-flutter-${ts}-${DateTime.now().microsecond}';
    final routes = List<String>.from(route)..sort();
    final base = '1|${type}_$ts|${ts}|$type|$name|0|$stream|$qos|${routes.join(",")}|esp32-01|$nonce|$ts|${ts+60000}';
    return {
      'v': 1, 'msgId': '${name}_$ts', 'ts': ts, 'type': type, 'name': name,
      'seq': 0, 'streamId': stream, 'value': value, 'qos': qos,
      'route': route, 'auth': {'id':'esp32-01','token':_token,'nonce':nonce,'ts':ts,'exp':ts+60000,'sig':_hmac(base)},
      'meta': {'deviceId':'flutter','platform':'flutter'}
    };
  }

  Future<void> send(Map<String, dynamic> msg) async {
    final route = List<String>.from(msg['route'] ?? []);
    if (route.contains('udp') && _udp != null) {
      final d = jsonEncode(msg).codeUnits;
      _udp!.send(d, InternetAddress(host), udpPort);
    }
    if (route.contains('ws') && _ws != null) _ws!.sink.add(jsonEncode(msg));
    if (route.contains('http')) {
      final res = await HttpClient().postUrl(Uri.parse('http://$host:$httpPort/message'))
        ..headers.set('Content-Type', 'application/json')
        ..headers.set('X-UDCP-Token', _token)
        ..write(jsonEncode(msg));
      await res.close();
    }
  }

  Stream<String> get udpStream => _udpRx.stream;
  Stream<String> get wsStream => _wsRx.stream;
  void dispose() { _ws?.sink.close(); _udp?.close(); _udpRx.close(); _wsRx.close(); }
}

// ──────────────────────────────────────────────────────────────
// UI
// ──────────────────────────────────────────────────────────────
class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final UdcpClient client;
  final List<String> logs = [];
  double slider = 0.5;
  double stickX = 0, stickY = 0;

  @override
  void initState() {
    super.initState();
    client = UdcpClient();
    client.connect().then((_) {
      client.wsStream.listen((m) => _log('[WS] $m'));
      client.udpStream.listen((m) => _log('[UDP] $m'));
    });
  }

  void _log(String m) => setState(() => logs.insert(0, m));

  Future<void> _send(String type, String name, Map<String,dynamic> val, int qos, List<String> route) async {
    final msg = client._buildBase(type, name, qos, '${name}-stream', route, val);
    await client.send(msg);
    _log('[OUT] $type/$name -> ${route.join("+")}');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('UDCP v4 Mobile')),
    body: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
      Wrap(spacing:12, runSpacing:12, children: [
        ElevatedButton(onPressed: ()=>_send('event','button',{'state':1},1,['ws']), child:const Text('Button')),
        ElevatedButton(onPressed: ()=>_send('stream','motion',{'ax':0.1,'ay':-0.2,'az':9.8},0,['udp']), child:const Text('Motion')),
        ElevatedButton(onPressed: ()=>_send('state','color',{'r':255,'g':165,'b':0},1,['http']), child:const Text('Color')),
      ]),
      const SizedBox(height:20),
      Text('Slider: ${slider.toStringAsFixed(2)}'),
      Slider(value: slider, onChanged: (v) { setState(()=>slider=v); _send('stream','slider',{'value':v},1,['ws']); }),
      const SizedBox(height:10),
      Row(children: [
        Expanded(child: Slider(min:-1,max:1,value:stickX,onChanged:(v){setState(()=>stickX=v);_send('stream','stick',{'x':v,'y':stickY},0,['udp']);})),
        Expanded(child: Slider(min:-1,max:1,value:stickY,onChanged:(v){setState(()=>stickY=v);_send('stream','stick',{'x':stickX,'y':v},0,['udp']);})),
      ]),
      const SizedBox(height:20),
      Expanded(child: ListView.builder(itemCount:logs.length, itemBuilder:(c,i)=>Text(logs[i])))
    ])),
  );

  @override
  void dispose() { client.dispose(); super.dispose(); }
}

---
