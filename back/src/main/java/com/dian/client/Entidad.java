
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for Entidad complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="Entidad">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="Nombre" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="NumeroDoc" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Procedencia" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="TipoDoc" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "Entidad", namespace = "http://schemas.datacontract.org/2004/07/Entidad", propOrder = {
    "nombre",
    "numeroDoc",
    "procedencia",
    "tipoDoc"
})
public class Entidad {

    @XmlElementRef(name = "Nombre", namespace = "http://schemas.datacontract.org/2004/07/Entidad", type = JAXBElement.class, required = false)
    protected JAXBElement<String> nombre;
    @XmlElementRef(name = "NumeroDoc", namespace = "http://schemas.datacontract.org/2004/07/Entidad", type = JAXBElement.class, required = false)
    protected JAXBElement<String> numeroDoc;
    @XmlElementRef(name = "Procedencia", namespace = "http://schemas.datacontract.org/2004/07/Entidad", type = JAXBElement.class, required = false)
    protected JAXBElement<String> procedencia;
    @XmlElementRef(name = "TipoDoc", namespace = "http://schemas.datacontract.org/2004/07/Entidad", type = JAXBElement.class, required = false)
    protected JAXBElement<String> tipoDoc;

    /**
     * Gets the value of the nombre property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getNombre() {
        return nombre;
    }

    /**
     * Sets the value of the nombre property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setNombre(JAXBElement<String> value) {
        this.nombre = value;
    }

    /**
     * Gets the value of the numeroDoc property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getNumeroDoc() {
        return numeroDoc;
    }

    /**
     * Sets the value of the numeroDoc property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setNumeroDoc(JAXBElement<String> value) {
        this.numeroDoc = value;
    }

    /**
     * Gets the value of the procedencia property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getProcedencia() {
        return procedencia;
    }

    /**
     * Sets the value of the procedencia property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setProcedencia(JAXBElement<String> value) {
        this.procedencia = value;
    }

    /**
     * Gets the value of the tipoDoc property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getTipoDoc() {
        return tipoDoc;
    }

    /**
     * Sets the value of the tipoDoc property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setTipoDoc(JAXBElement<String> value) {
        this.tipoDoc = value;
    }

}
