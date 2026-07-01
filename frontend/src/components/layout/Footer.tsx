import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>Bravo Music</h3>
          <p>Zambia's Premier Music Streaming and Promotion Platform</p>
          <div className="social-links">
            <a href="https://www.facebook.com/share/1BWUEGTGVp/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i className="fab fa-facebook-f" /></a>
            <a href="https://youtube.com/@protestmunsanje" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><i className="fab fa-youtube" /></a>
          </div>
        </div>

        <div className="footer-section">
          <h3>For Listeners</h3>
          <ul>
            <li><Link to="/browse">Browse Music</Link></li>
            <li><Link to="/trending">Trending</Link></li>
            <li><Link to="/playlists">Playlists</Link></li>
            <li><a href="#">Mobile App</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>For Artists</h3>
          <ul>
            <li><Link to="/register?role=artist">Become an Artist</Link></li>
            <li><Link to="/subscription">Subscription Plans</Link></li>
            <li><Link to="/promotion">Promotion Packages</Link></li>
            <li><Link to="/artist-resources">Artist Resources</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>Support</h3>
          <ul>
            <li>
              <a href="mailto:support@bravomusics.com">
                <i className="fas fa-envelope mr-2" />support@bravomusics.com
              </a>
            </li>
            <li>
              <a href="https://wa.me/260760775472" target="_blank" rel="noopener noreferrer">
                <i className="fab fa-whatsapp mr-2" />0760 775 472
              </a>
            </li>
            <li><Link to="/terms">Terms of Service</Link></li>
            <li><Link to="/privacy">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Bravo Music. All rights reserved. Zambia's Premier Music Platform.</p>
      </div>
    </footer>
  )
}
