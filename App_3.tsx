import VirtualHardware from './components/modules/VirtualHardware';
import AIVision from './components/modules/AIVision';

...

<div className="col-span-3 space-y-6">

  <DeviceFleet/>
  <PacketInspector/>
  <StreamVisualizer streamId="motion-imu"/>

  <CommandCenter deviceId="esp32-01"/>
  <RuleEngine/>

  <VirtualHardware/>
  <AIVision/>

</div>
