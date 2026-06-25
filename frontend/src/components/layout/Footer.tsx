import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>Bravo Music</h3>
          <p>Zambia's Premier Music Streaming and Promotion Platform</p>
          <div className="social-links">
            <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f" /></a>
            <a href="#" aria-label="Twitter"><i className="fab fa-twitter" /></a>
            <a href="#" aria-label="Instagram"><i className="fab fa-instagram" /></a>
            <a href="#" aria-label="YouTube"><i className="fab fa-youtube" /></a>
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
            <li><a href="#">Promotion Packages</a></li>
            <li><a href="#">Artist Resources</a></li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>Support</h3>
          <ul>
            <li><a href="#">Help Center</a></li>
            <li><a href="#">Contact Us</a></li>
            <li><a href="#">Terms of Service</a></li>
            <li><a href="#">Privacy Policy</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Bravo Music. All rights reserved. Zambia's Premier Music Platform.</p>
      </div>
    </footer>
  )
}
