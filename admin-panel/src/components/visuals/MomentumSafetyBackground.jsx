import momentumMark from "../../assets/topbarlogo.svg";

const MomentumSafetyBackground = ({ intensity = "normal" }) => (
  <div className={`momentum-safety-bg momentum-safety-bg--${intensity} pointer-events-none absolute inset-0 overflow-hidden`} aria-hidden="true">
    <div className="momentum-safety-bg__base" />
    <div className="momentum-safety-bg__grid" />
    <img className="momentum-safety-bg__mark" src={momentumMark} alt="" draggable="false" />
    <div className="momentum-safety-bg__vignette" />
  </div>
);

export default MomentumSafetyBackground;
