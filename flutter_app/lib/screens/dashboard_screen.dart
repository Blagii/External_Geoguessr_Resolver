import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/location_data.dart';
import '../services/geocoding_service.dart';
import '../services/websocket_service.dart';
import 'connect_screen.dart';

class DashboardScreen extends StatefulWidget {
  final WebSocketService wsService;

  const DashboardScreen({super.key, required this.wsService});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  static const Color neonGreen = Color(0xFF56FF0A);
  static const Color bgDark = Color(0xFF0A0A0A);
  static const Color cardDark = Color(0xFF171717);
  static const Color tileDark = Color(0xFF1E1E1E);
  static const Color borderDark = Color(0xFF262626);

  final MapController _mapController = MapController();

  LocationDetails _details = const LocationDetails();
  bool _isLoadingDetails = false;
  double? _lastLat;
  double? _lastLng;
  double _currentZoom = 5.0;

  @override
  void initState() {
    super.initState();
    widget.wsService.addListener(_onWsUpdate);
    // Check if location data is already available upon entering screen
    _onWsUpdate();
  }

  void _onWsUpdate() {
    if (!mounted) return;
    final loc = widget.wsService.locationData;
    if (loc != null && (loc.lat != _lastLat || loc.lng != _lastLng)) {
      _lastLat = loc.lat;
      _lastLng = loc.lng;

      // Move map to new coordinates if map is rendered
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          _mapController.move(LatLng(loc.lat, loc.lng), _currentZoom);
        } catch (_) {}
      });

      _fetchLocationDetails(loc.lat, loc.lng);
    } else {
      setState(() {});
    }
  }

  Future<void> _fetchLocationDetails(double lat, double lng) async {
    setState(() {
      _isLoadingDetails = true;
    });

    final result = await GeocodingService.reverseGeocode(lat, lng);
    if (!mounted) return;

    setState(() {
      _details = result;
      _isLoadingDetails = false;
    });
  }

  void _disconnectAndReturn() {
    widget.wsService.removeListener(_onWsUpdate);
    widget.wsService.disconnect();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => ConnectScreen(wsService: widget.wsService),
      ),
    );
  }

  void _zoomMap(double delta) {
    final loc = widget.wsService.locationData;
    if (loc == null) return;
    _currentZoom = (_currentZoom + delta).clamp(2.0, 18.0);
    try {
      final center = _mapController.camera.center;
      _mapController.move(center, _currentZoom);
    } catch (_) {
      _mapController.move(LatLng(loc.lat, loc.lng), _currentZoom);
    }
  }

  void _recenterMap() {
    final loc = widget.wsService.locationData;
    if (loc == null) return;
    try {
      _mapController.move(LatLng(loc.lat, loc.lng), _currentZoom);
    } catch (_) {}
  }

  Future<void> _copyCoords(double lat, double lng) async {
    final text = '${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}';
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: cardDark,
        content: Text(
          'Koordinate kopirane: $text',
          style: const TextStyle(color: neonGreen),
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  void dispose() {
    widget.wsService.removeListener(_onWsUpdate);
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loc = widget.wsService.locationData;
    final isConnected = widget.wsService.isConnected;
    final isReconnecting = widget.wsService.isReconnecting;

    return Scaffold(
      backgroundColor: bgDark,
      appBar: AppBar(
        backgroundColor: cardDark,
        surfaceTintColor: Colors.transparent,
        title: Row(
          children: [
            const Icon(Icons.public, color: neonGreen, size: 22),
            const SizedBox(width: 8),
            Text(
              'GeoGuessr Live Viewer',
              style: TextStyle(
                color: neonGreen,
                fontWeight: FontWeight.w800,
                fontSize: 18,
                shadows: [
                  Shadow(
                    color: neonGreen.withAlpha(90),
                    blurRadius: 8,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          _buildStatusBadge(isConnected, isReconnecting),
          const SizedBox(width: 8),
          IconButton(
            tooltip: 'Prekini vezu',
            onPressed: _disconnectAndReturn,
            icon: const Icon(Icons.logout, color: Colors.white70, size: 20),
          ),
        ],
      ),
      body: loc == null
          ? _buildWaitingScreen()
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Interactive Map Card
                    Container(
                      decoration: BoxDecoration(
                        color: cardDark,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: borderDark),
                      ),
                      child: Column(
                        children: [
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Row(
                                  children: [
                                    Icon(
                                      Icons.navigation,
                                      color: neonGreen,
                                      size: 20,
                                    ),
                                    SizedBox(width: 8),
                                    Text(
                                      'Map View',
                                      style: TextStyle(
                                        color: neonGreen,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: () => _copyCoords(loc.lat, loc.lng),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: tileDark,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: borderDark),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.copy,
                                          color: neonGreen,
                                          size: 14,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          '${loc.lat.toStringAsFixed(4)}, ${loc.lng.toStringAsFixed(4)}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontFamily: 'monospace',
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                              bottom: Radius.circular(13),
                            ),
                            child: SizedBox(
                              height: 310,
                              child: Stack(
                                children: [
                                  FlutterMap(
                                    mapController: _mapController,
                                    options: MapOptions(
                                      initialCenter: LatLng(loc.lat, loc.lng),
                                      initialZoom: _currentZoom,
                                      onPositionChanged: (pos, _) {
                                        _currentZoom = pos.zoom;
                                      },
                                    ),
                                    children: [
                                      TileLayer(
                                        urlTemplate:
                                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                        userAgentPackageName:
                                            'com.georesolver.mobile',
                                      ),
                                      MarkerLayer(
                                        markers: [
                                          Marker(
                                            point: LatLng(loc.lat, loc.lng),
                                            width: 48,
                                            height: 48,
                                            child: const Icon(
                                              Icons.location_on,
                                              color: Colors.redAccent,
                                              size: 44,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  // Map Controls (Zoom in/out + Recenter)
                                  Positioned(
                                    right: 10,
                                    bottom: 10,
                                    child: Column(
                                      children: [
                                        _mapIconBtn(
                                          icon: Icons.my_location,
                                          tooltip: 'Centriraj na lokaciju',
                                          onTap: _recenterMap,
                                        ),
                                        const SizedBox(height: 6),
                                        _mapIconBtn(
                                          icon: Icons.add,
                                          tooltip: 'Uvećaj',
                                          onTap: () => _zoomMap(1.5),
                                        ),
                                        const SizedBox(height: 6),
                                        _mapIconBtn(
                                          icon: Icons.remove,
                                          tooltip: 'Umanji',
                                          onTap: () => _zoomMap(-1.5),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Location Details Card
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: cardDark,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: borderDark),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.public, color: neonGreen, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'Location Details',
                                style: TextStyle(
                                  color: neonGreen,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          if (_isLoadingDetails)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 32),
                              child: Column(
                                children: [
                                  CircularProgressIndicator(color: neonGreen),
                                  SizedBox(height: 12),
                                  Text(
                                    'Učitavanje detalja o lokaciji...',
                                    style: TextStyle(color: Colors.white70),
                                  ),
                                ],
                              ),
                            )
                          else
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              mainAxisSpacing: 10,
                              crossAxisSpacing: 10,
                              childAspectRatio: 1.85,
                              children: [
                                _buildDetailTile(
                                  'Country',
                                  _details.country,
                                  Icons.public,
                                ),
                                _buildDetailTile(
                                  'State / Region',
                                  _details.state,
                                  Icons.map_outlined,
                                ),
                                _buildDetailTile(
                                  'County',
                                  _details.county,
                                  Icons.route,
                                ),
                                _buildDetailTile(
                                  'City / Town',
                                  _details.displayCity,
                                  Icons.location_city,
                                ),
                                _buildDetailTile(
                                  'Area',
                                  _details.displayArea,
                                  Icons.home_work_outlined,
                                ),
                                _buildDetailTile(
                                  'Road',
                                  _details.road,
                                  Icons.alt_route,
                                ),
                                _buildDetailTile(
                                  'Postcode',
                                  _details.postcode,
                                  Icons.pin_drop_outlined,
                                ),
                                _buildDetailTile(
                                  'Place',
                                  _details.displayPlace,
                                  Icons.place_outlined,
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildWaitingScreen() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(
              width: 48,
              height: 48,
              child: CircularProgressIndicator(
                color: neonGreen,
                strokeWidth: 3.5,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Waiting for game info',
              style: TextStyle(
                color: neonGreen,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Pokrenite GeoGuessr partiju na kompjuteru.\nLokacija će se automatski pojaviti ovde.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white60,
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            OutlinedButton.icon(
              onPressed: _disconnectAndReturn,
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white70,
                side: const BorderSide(color: borderDark),
              ),
              icon: const Icon(Icons.arrow_back, size: 18),
              label: const Text('Nazad na povezivanje'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(bool connected, bool reconnecting) {
    Color color = Colors.redAccent;
    String label = 'Offline';
    if (reconnecting) {
      color = Colors.amber;
      label = 'Reconnecting';
    } else if (connected) {
      color = neonGreen;
      label = 'Online';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withAlpha(36),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withAlpha(128)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailTile(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: tileDark,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderDark),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: neonGreen, size: 15),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _mapIconBtn({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Material(
      color: cardDark.withAlpha(230),
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderDark),
          ),
          child: Icon(icon, color: neonGreen, size: 20),
        ),
      ),
    );
  }
}
