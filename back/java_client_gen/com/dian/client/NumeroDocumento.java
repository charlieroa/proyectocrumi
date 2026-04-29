
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for NumeroDocumento complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="NumeroDocumento">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="FechaEmision" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="FechaFirma" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Folio" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Serie" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "NumeroDocumento", namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", propOrder = {
    "fechaEmision",
    "fechaFirma",
    "folio",
    "serie"
})
public class NumeroDocumento {

    @XmlElementRef(name = "FechaEmision", namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> fechaEmision;
    @XmlElementRef(name = "FechaFirma", namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> fechaFirma;
    @XmlElementRef(name = "Folio", namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> folio;
    @XmlElementRef(name = "Serie", namespace = "http://schemas.datacontract.org/2004/07/NumeroDocumento", type = JAXBElement.class, required = false)
    protected JAXBElement<String> serie;

    /**
     * Gets the value of the fechaEmision property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getFechaEmision() {
        return fechaEmision;
    }

    /**
     * Sets the value of the fechaEmision property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setFechaEmision(JAXBElement<String> value) {
        this.fechaEmision = value;
    }

    /**
     * Gets the value of the fechaFirma property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getFechaFirma() {
        return fechaFirma;
    }

    /**
     * Sets the value of the fechaFirma property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setFechaFirma(JAXBElement<String> value) {
        this.fechaFirma = value;
    }

    /**
     * Gets the value of the folio property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getFolio() {
        return folio;
    }

    /**
     * Sets the value of the folio property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setFolio(JAXBElement<String> value) {
        this.folio = value;
    }

    /**
     * Gets the value of the serie property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getSerie() {
        return serie;
    }

    /**
     * Sets the value of the serie property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setSerie(JAXBElement<String> value) {
        this.serie = value;
    }

}
