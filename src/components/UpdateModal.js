import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import ReactNativeBlobUtil from 'react-native-blob-util';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const UpdateModal = ({ visible, updateData, onDismiss }) => {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!updateData) return null;

  const { version_name, release_notes, download_url, is_mandatory } = updateData;

  const handleUpdate = async () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(download_url);
      return;
    }

    // Android APK Download & Install
    setIsDownloading(true);
    setDownloadProgress(0);

    const { config, fs, android } = ReactNativeBlobUtil;
    // Download to a folder that is configured in file_paths.xml for FileProvider
    const updatesDir = `${fs.dirs.CacheDir}/updates`;
    const apkPath = `${updatesDir}/jeplus_v${version_name}.apk`;

    try {
      // Ensure directory exists
      if (!(await fs.isDir(updatesDir))) {
        await fs.mkdir(updatesDir);
      }

      // 1. Check if file already exists
      const exists = await fs.exists(apkPath);
      if (exists) {
        setIsDownloading(false);
        try {
          console.log('File exists, trying to install:', apkPath);
          await android.actionViewIntent(apkPath, 'application/vnd.android.package-archive');
          return;
        } catch (e) {
          console.log('Existing file install failed, re-downloading...');
          await fs.unlink(apkPath);
        }
      }

      // 2. Start Download
      setIsDownloading(true);
      const res = await config({
        path: apkPath,
        fileCache: true,
        // When downloading to internal CacheDir, we shouldn't use system DownloadManager
        // as it cannot write to private app folders.
      })
        .fetch('GET', download_url)
        .progress((received, total) => {
          if (total > 0) {
            setDownloadProgress(Math.floor((received / total) * 100));
          }
        });

      setIsDownloading(false);

      // 3. Trigger Installation
      const downloadedPath = res.path();
      console.log('Download complete. Installing from:', downloadedPath);
      
      // Delay slightly to ensure file is closed/flushed
      setTimeout(async () => {
        try {
          await android.actionViewIntent(downloadedPath, 'application/vnd.android.package-archive');
        } catch (err) {
          console.error('Install Error:', err);
          // Final fallback: Browser download
          Alert.alert(
            'Install Failed',
            'Could not open the installer automatically. Please check your Downloads folder or download manually.',
            [
              { text: 'Download Manually', onPress: () => Linking.openURL(download_url) },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }
      }, 500);

    } catch (error) {
      setIsDownloading(false);
      console.error('Download Error:', error);
      Alert.alert(
        'Download Error',
        'Failed to download update. Switching to manual download.',
        [{ text: 'OK', onPress: () => Linking.openURL(download_url) }]
      );
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!is_mandatory) onDismiss();
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#34C759', '#2E9D47']}
            style={styles.header}
          >
            <Icon name="rocket-launch" size={60} color="#fff" />
            <Text style={styles.headerTitle}>New Version Available!</Text>
            <Text style={styles.versionTag}>v{version_name}</Text>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.whatsNew}>What's New:</Text>
            <Text style={styles.releaseNotes}>{release_notes || 'Improvements and bug fixes.'}</Text>
            
            {is_mandatory && (
              <View style={styles.mandatoryBadge}>
                <Icon name="alert-circle" size={16} color="#FF3B30" />
                <Text style={styles.mandatoryText}>Mandatory Update Required</Text>
              </View>
            )}

            {isDownloading ? (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color="#34C759" />
                <Text style={styles.progressText}>Downloading: {downloadProgress}%</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
                <Text style={styles.updateButtonText}>Update Now</Text>
              </TouchableOpacity>
            )}

            {!is_mandatory && !isDownloading && (
              <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.85,
    backgroundColor: '#fff',
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 10,
  },
  versionTag: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 15,
  },
  content: {
    padding: 25,
  },
  whatsNew: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  releaseNotes: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  mandatoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 20,
  },
  mandatoryText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 5,
  },
  updateButton: {
    backgroundColor: '#34C759',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  laterButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  progressText: {
    marginTop: 10,
    color: '#333',
    fontWeight: '600',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34C759',
  },
});

export default UpdateModal;
