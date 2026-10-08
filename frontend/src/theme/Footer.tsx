import { Link } from "react-router-dom";
import { useSettings } from "../api/hooks";

export function Footer() {
  const { data: s } = useSettings();
  const year = new Date().getFullYear();
  return (
    <footer className="footer footer--dark">
      <div className="container container--fluid">
        <div className="row footer__links">
          <div className="col footer__col">
            <div className="footer__title">Docs</div>
            <ul className="footer__items clean-list">
              <li className="footer__item">
                <Link className="footer__link-item" to="/docs">
                  Start here
                </Link>
              </li>
              <li className="footer__item">
                <Link className="footer__link-item" to="/docs/reading-plan">
                  Reading plan
                </Link>
              </li>
              <li className="footer__item">
                <Link className="footer__link-item" to="/docs/planned-analysis">
                  Planned analysis
                </Link>
              </li>
            </ul>
          </div>
          <div className="col footer__col">
            <div className="footer__title">Explore</div>
            <ul className="footer__items clean-list">
              <li className="footer__item">
                <Link className="footer__link-item" to="/papers">
                  Papers
                </Link>
              </li>
              <li className="footer__item">
                <Link className="footer__link-item" to="/proteins">
                  Proteins
                </Link>
              </li>
              <li className="footer__item">
                <Link
                  className="footer__link-item"
                  to="/visualise/evidence-matrix"
                >
                  Evidence matrix
                </Link>
              </li>
            </ul>
          </div>
          <div className="col footer__col">
            <div className="footer__title">Project</div>
            <ul className="footer__items clean-list">
              <li className="footer__item">
                <Link className="footer__link-item" to="/pipeline">
                  Pipeline
                </Link>
              </li>
              <li className="footer__item">
                <Link className="footer__link-item" to="/decisions">
                  Decisions
                </Link>
              </li>
              <li className="footer__item">
                <Link className="footer__link-item" to="/docs/data-policy">
                  Data policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom text--center">
          <div className="footer__copyright">
            {s?.footer_text || "No participant-level data is stored here."} ©{" "}
            {year} {s?.site_title}
          </div>
        </div>
      </div>
    </footer>
  );
}
