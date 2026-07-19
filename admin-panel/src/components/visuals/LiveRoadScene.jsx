const laneMarkers = Array.from({ length: 8 }, (_, index) => index);
const streetlights = Array.from({ length: 6 }, (_, index) => index);

const LiveRoadScene = () => (
  <div className="login-road-scene" aria-hidden="true" data-testid="live-road-scene">
    <div className="login-road-scene__sky" />
    <div className="login-road-scene__horizon-glow" />
    <div className="login-road-scene__hills login-road-scene__hills--far" />
    <div className="login-road-scene__hills login-road-scene__hills--near" />
    <div className="login-road-scene__road-wrap">
      <div className="login-road-scene__road">
        <div className="login-road-scene__edge login-road-scene__edge--left" />
        <div className="login-road-scene__edge login-road-scene__edge--right" />
        {laneMarkers.map((marker) => <span className="login-road-scene__lane" key={marker} style={{ "--lane-delay": `${marker * -0.42}s` }} />)}
      </div>
      <div className="login-road-scene__rail login-road-scene__rail--left" />
      <div className="login-road-scene__rail login-road-scene__rail--right" />
      <div className="login-road-scene__lights login-road-scene__lights--left">
        {streetlights.map((light) => <span key={light} style={{ "--light-delay": `${light * -0.72}s` }} />)}
      </div>
      <div className="login-road-scene__lights login-road-scene__lights--right">
        {streetlights.map((light) => <span key={light} style={{ "--light-delay": `${light * -0.72}s` }} />)}
      </div>
      <div className="login-road-scene__vehicle"><span /><span /></div>
      <div className="login-road-scene__sign"><strong>SAFETY</strong><small>FIRST</small></div>
    </div>
    <div className="login-road-scene__fog" />
  </div>
);

export default LiveRoadScene;
